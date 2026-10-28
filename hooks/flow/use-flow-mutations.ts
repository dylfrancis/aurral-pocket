import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { ApiError } from "@/lib/api/client";
import {
  addSharedPlaylistTracks,
  convertFlowToStaticPlaylist,
  createFlow,
  createSharedPlaylist,
  deleteFlow,
  deleteSharedPlaylist,
  deleteSharedPlaylistTrack,
  getPlaylistJobs,
  researchSharedPlaylistTrack,
  setFlowEnabled,
  setRetryCyclePaused,
  startFlow,
  updateFlow,
  updateSharedPlaylist,
} from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";
import type {
  FlowFormValues,
  FlowStatusSnapshot,
  SharedPlaylistTrack,
} from "@/lib/types/flow";

/** An ApiError's message is the server's `error` field when it sent one. */
function toastError(title: string, err: Error) {
  Burnt.toast({ title, message: err.message, preset: "error" });
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
    mutationFn: (payload: FlowFormValues) => createFlow(payload),
    onSuccess: invalidate,
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
    }) => updateFlow(flowId, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteFlow() {
  const invalidate = useFlowInvalidate();
  return useMutation({
    mutationFn: (flowId: string) => deleteFlow(flowId),
    onSettled: invalidate,
  });
}

export function useSetFlowEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flowId, enabled }: { flowId: string; enabled: boolean }) =>
      setFlowEnabled(flowId, enabled),
    onMutate: async ({ flowId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: flowKeys.status() });
      const prev = queryClient.getQueryData<FlowStatusSnapshot>(
        flowKeys.status(),
      );
      if (prev) {
        queryClient.setQueryData<FlowStatusSnapshot>(flowKeys.status(), {
          ...prev,
          flows: prev.flows.map((f) =>
            f.id === flowId ? { ...f, enabled } : f,
          ),
        });
      }
      return { prev };
    },
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
      convertFlowToStaticPlaylist(flowId, name),
    onSuccess: invalidate,
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
 * Resuming clears the pause flag but leaves failed tracks failed on every
 * Aurral version, so each one is searched again here. A refused track does
 * not stop the rest; any other failure is reported.
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
