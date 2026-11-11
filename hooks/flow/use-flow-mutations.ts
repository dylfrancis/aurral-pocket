import { Alert } from "react-native";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import * as Burnt from "burnt";
import { ApiError } from "@/lib/api/client";
import {
  addSharedPlaylistTracks,
  convertFlowToStaticPlaylist,
  createFlow,
  createFlowFromTemplate,
  createSharedPlaylist,
  deleteFlow,
  deleteSharedPlaylist,
  deleteSharedPlaylistTrack,
  downloadSavedFlowTracks,
  getPlaylistJobs,
  researchSharedPlaylistTrack,
  setFlowEnabled,
  setRetryCyclePaused,
  startFlow,
  updateFlow,
  updateSharedPlaylist,
} from "@/lib/api/flow";
import { activityKeys, flowKeys } from "@/lib/query-keys";
import type {
  Flow,
  FlowFormValues,
  FlowJob,
  FlowStatusSnapshot,
  SharedPlaylistTrack,
} from "@/lib/types/flow";

/**
 * An ApiError's message is the server's `message` field, or its `error` field
 * when the body has no `message`.
 */
function toastError(title: string, err: Error) {
  Burnt.toast({ title, message: err.message, preset: "error" });
}

const NAME_CONFLICT = /^(?:Flow name|Playlist) "(.+)" already exists$/;

/**
 * Flows and static playlists share one namespace, but the server words a
 * conflict by the kind being saved: `Flow name "Chill" already exists` can mean
 * a static playlist, which the Flows tab doesn't list. Saves to a static
 * playlist never reach this: they are queued, so the server has already
 * answered by the time it checks the name.
 */
function rethrowClearNameConflict(err: unknown): never {
  if (err instanceof ApiError) {
    const name = NAME_CONFLICT.exec(err.message)?.[1];
    if (name) {
      throw new ApiError(
        err.status,
        `"${name}" is already used by a flow or a playlist.`,
        err.body,
      );
    }
  }
  throw err;
}

function useFlowInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: flowKeys.status() }),
      queryClient.invalidateQueries({ queryKey: flowKeys.jobsAll() }),
    ]);
}

export function useCreateFlow() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: (payload: FlowFormValues) =>
      createFlow(payload).catch(rethrowClearNameConflict),
    onSuccess: invalidate,
  });
}

/**
 * Adds the new flow to the cached snapshot, so its page can open before the
 * next status poll lands.
 */
export function useCreateFlowFromTemplate() {
  const queryClient = useQueryClient();
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: (templateId: string) =>
      createFlowFromTemplate(templateId).catch(rethrowClearNameConflict),
    onSuccess: async (flow) => {
      // A poll already in flight would put back a snapshot without the flow.
      await queryClient.cancelQueries({ queryKey: flowKeys.status() });
      queryClient.setQueryData<FlowStatusSnapshot>(flowKeys.status(), (prev) =>
        prev && !prev.flows.some((entry) => entry.id === flow.id)
          ? { ...prev, flows: [...prev.flows, flow] }
          : prev,
      );
      void invalidate();
    },
  });
}

export function useUpdateFlow() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({
      flowId,
      payload,
    }: {
      flowId: string;
      payload: Partial<FlowFormValues>;
    }) => updateFlow(flowId, payload).catch(rethrowClearNameConflict),
    onSuccess: invalidate,
  });
}

export function useDeleteFlow() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: (flowId: string) => deleteFlow(flowId),
    onSettled: invalidate,
    onError: (err) => toastError("Couldn't delete flow", err),
  });
}

async function patchCachedFlow(
  queryClient: QueryClient,
  flowId: string,
  patch: Partial<Flow>,
) {
  await queryClient.cancelQueries({ queryKey: flowKeys.status() });
  const prev = queryClient.getQueryData<FlowStatusSnapshot>(flowKeys.status());
  if (prev) {
    queryClient.setQueryData<FlowStatusSnapshot>(flowKeys.status(), {
      ...prev,
      flows: prev.flows.map((f) => (f.id === flowId ? { ...f, ...patch } : f)),
    });
  }
  return { prev };
}

export function useSetFlowEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flowId, enabled }: { flowId: string; enabled: boolean }) =>
      setFlowEnabled(flowId, enabled),
    onMutate: ({ flowId, enabled }) =>
      patchCachedFlow(queryClient, flowId, { enabled }),
    onError: (err, { enabled }, context) => {
      if (context?.prev) {
        queryClient.setQueryData(flowKeys.status(), context.prev);
      }
      toastError(
        enabled ? "Couldn't turn on flow" : "Couldn't turn off flow",
        err,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: flowKeys.status() });
      queryClient.invalidateQueries({ queryKey: flowKeys.jobsAll() });
    },
  });
}

export function useSetFlowAutoDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      flowId,
      autoDownload,
    }: {
      flowId: string;
      autoDownload: boolean;
    }) => updateFlow(flowId, { autoDownload }),
    onMutate: ({ flowId, autoDownload }) =>
      patchCachedFlow(queryClient, flowId, { autoDownload }),
    onError: (err, _variables, context) => {
      if (context?.prev) {
        queryClient.setQueryData(flowKeys.status(), context.prev);
      }
      toastError("Couldn't change automatic downloads", err);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: flowKeys.status() }),
  });
}

function setCachedJobStatuses(
  queryClient: QueryClient,
  flowId: string,
  jobIds: ReadonlySet<string>,
  status: FlowJob["status"],
) {
  queryClient.setQueryData<FlowJob[]>(flowKeys.jobs(flowId), (jobs) =>
    jobs?.map((job) => (jobIds.has(job.id) ? { ...job, status } : job)),
  );
}

/**
 * The server answers before the jobs move, so refetching them on success would
 * bring back the saved rows for a moment.
 */
export function useDownloadSavedFlowTracks() {
  const queryClient = useQueryClient();
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: (flowId: string) => downloadSavedFlowTracks(flowId),
    onMutate: async (flowId) => {
      await queryClient.cancelQueries({ queryKey: flowKeys.jobs(flowId) });
      const savedIds = new Set(
        queryClient
          .getQueryData<FlowJob[]>(flowKeys.jobs(flowId))
          ?.filter((job) => job.status === "saved")
          .map((job) => job.id),
      );
      setCachedJobStatuses(queryClient, flowId, savedIds, "pending");
      return { savedIds };
    },
    onSuccess: (_data, _flowId, { savedIds }) => {
      Burnt.toast({
        title: `Downloading ${savedIds.size} track${savedIds.size === 1 ? "" : "s"}`,
        preset: "done",
      });
      void queryClient.invalidateQueries({ queryKey: flowKeys.status() });
      void queryClient.invalidateQueries({ queryKey: activityKeys.list() });
    },
    onError: (err, flowId, context) => {
      if (context) {
        setCachedJobStatuses(queryClient, flowId, context.savedIds, "saved");
      }
      void invalidate();
      // The message lists the sources to set up. It's too long for a toast,
      // and Android's toast shows only the title.
      if (err instanceof ApiError && err.status === 409) {
        Alert.alert("Couldn't Download", err.message);
        return;
      }
      toastError("Couldn't download tracks", err);
    },
  });
}

export function useStartFlow() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({ flowId, limit }: { flowId: string; limit?: number }) =>
      startFlow(flowId, limit),
    onSuccess: invalidate,
    onError: (err) => toastError("Couldn't start flow", err),
  });
}

export function useConvertFlowToStaticPlaylist() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({ flowId, name }: { flowId: string; name?: string }) =>
      convertFlowToStaticPlaylist(flowId, name).catch(rethrowClearNameConflict),
    onSuccess: (playlist) => {
      // Android's toast shows only the title, so the place goes there.
      Burnt.toast({
        title: "Saved to Playlists in Library",
        message: playlist.name,
        preset: "done",
      });
      return invalidate();
    },
    onError: (err) => toastError("Couldn't save playlist", err),
  });
}

export function useCreateSharedPlaylist() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: (payload: { name: string; tracks?: SharedPlaylistTrack[] }) =>
      createSharedPlaylist(payload),
    onSuccess: invalidate,
  });
}

export function useAddSharedPlaylistTracks() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({
      playlistId,
      tracks,
    }: {
      playlistId: string;
      tracks: SharedPlaylistTrack[];
    }) => addSharedPlaylistTracks(playlistId, tracks),
    onSuccess: invalidate,
  });
}

export function useUpdateSharedPlaylist() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({
      playlistId,
      payload,
    }: {
      playlistId: string;
      payload: { name?: string; tracks?: SharedPlaylistTrack[] };
    }) => updateSharedPlaylist(playlistId, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteSharedPlaylist() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: (playlistId: string) => deleteSharedPlaylist(playlistId),
    onSettled: invalidate,
    onError: (err) => toastError("Couldn't delete playlist", err),
  });
}

export function useDeleteSharedPlaylistTrack() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: ({
      playlistId,
      jobId,
    }: {
      playlistId: string;
      jobId: string;
    }) => deleteSharedPlaylistTrack(playlistId, jobId),
    onSuccess: invalidate,
    onError: (err) => toastError("Couldn't remove track", err),
  });
}

/**
 * The server refuses to requeue one track with a 409 (already downloading)
 * or a 404 (the job belongs to another playlist). That track keeps its state.
 */
function isTrackRefusal(err: unknown) {
  return err instanceof ApiError && (err.status === 404 || err.status === 409);
}

/**
 * Resuming clears the pause flag but leaves failed tracks failed, so each one
 * is searched again here. A refused track does not stop the rest; any other
 * failure is reported.
 */
async function requeueFailedTracks(playlistId: string) {
  const jobs = await getPlaylistJobs(playlistId);
  const results = await Promise.allSettled(
    jobs
      .filter((job) => job.status === "failed")
      .map((job) => researchSharedPlaylistTrack(playlistId, job.id)),
  );
  const failure = results.find(
    (result): result is PromiseRejectedResult =>
      result.status === "rejected" && !isTrackRefusal(result.reason),
  );
  if (failure) throw failure.reason;
}

export function useSetRetryCyclePaused() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: async ({
      playlistId,
      paused,
    }: {
      playlistId: string;
      paused: boolean;
    }) => {
      await setRetryCyclePaused(playlistId, paused);
      if (!paused) await requeueFailedTracks(playlistId);
    },
    // The pause flag may have changed even when the requeue fails.
    onSettled: invalidate,
    onError: (err, { paused }) =>
      toastError(
        paused ? "Couldn't pause retries" : "Couldn't resume retries",
        err,
      ),
  });
}
