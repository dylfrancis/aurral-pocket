import { useCallback } from "react";
import { Alert } from "react-native";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import type {
  TrackMenuAction,
  TrackMenuActionId,
} from "@/components/player/track-menu-types";
import { ApiError } from "@/lib/api/client";
import {
  cancelTrackJob,
  researchFlowTrack,
  researchSharedPlaylistTrack,
  retryTrackJob,
  type TrackJobControlResult,
} from "@/lib/api/flow";
import { activityKeys, flowKeys } from "@/lib/query-keys";
import { flowJobControls } from "@/lib/track-job-controls";
import type { FlowJob, FlowJobStatus } from "@/lib/types/flow";

/**
 * A 409 says why the server refused, such as "Track download is already
 * finished". Android's toast shows only the title, so the reason goes there.
 * A refused cleanup adds a longer explanation, which iOS shows below it.
 */
function toastControlError(fallbackTitle: string, err: Error) {
  const reason = conflictReason(err);
  if (reason) {
    Burnt.toast({
      title: reason,
      message: err.message === reason ? undefined : err.message,
      preset: "error",
    });
    return;
  }
  Burnt.toast({ title: fallbackTitle, message: err.message, preset: "error" });
}

function conflictReason(err: Error): string | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const label = (err.body as { error?: unknown } | undefined)?.error;
  return typeof label === "string" ? label : err.message;
}

function setCachedJobStatus(
  queryClient: QueryClient,
  jobId: string,
  status: FlowJobStatus,
) {
  queryClient.setQueriesData<FlowJob[]>(
    { queryKey: flowKeys.jobsAll() },
    (jobs) => jobs?.map((job) => (job.id === jobId ? { ...job, status } : job)),
  );
}

function cachedJobStatus(queryClient: QueryClient, jobId: string) {
  for (const [, jobs] of queryClient.getQueriesData<FlowJob[]>({
    queryKey: flowKeys.jobsAll(),
  })) {
    const job = jobs?.find((entry) => entry.id === jobId);
    if (job) return job.status;
  }
  return undefined;
}

/**
 * The track's row takes the new status at once, and the server's answer
 * replaces it. A poll already in flight would put back the old one.
 */
function useTrackJobControl(
  callApi: (jobId: string) => Promise<TrackJobControlResult>,
  optimisticStatus: FlowJobStatus,
  errorTitle: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => callApi(jobId),
    onMutate: async (jobId) => {
      await queryClient.cancelQueries({ queryKey: flowKeys.jobsAll() });
      const previous = cachedJobStatus(queryClient, jobId);
      setCachedJobStatus(queryClient, jobId, optimisticStatus);
      return { previous };
    },
    onSuccess: ({ jobId, status }) => {
      setCachedJobStatus(queryClient, jobId, status);
    },
    onError: (err, jobId, context) => {
      if (context?.previous) {
        setCachedJobStatus(queryClient, jobId, context.previous);
      }
      toastControlError(errorTitle, err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: flowKeys.jobsAll() });
      void queryClient.invalidateQueries({ queryKey: flowKeys.status() });
      void queryClient.invalidateQueries({ queryKey: activityKeys.list() });
    },
  });
}

export function useStopTrackDownload() {
  return useTrackJobControl(
    cancelTrackJob,
    "cancel_requested",
    "Couldn't stop the download",
  );
}

export function useRetryTrackDownload() {
  return useTrackJobControl(
    retryTrackJob,
    "pending",
    "Couldn't retry the download",
  );
}

/**
 * The server answers before the job moves, so refetching the jobs on success
 * would bring back the saved row for a moment. A static playlist gets saved
 * tracks from a shared playlist imported without its files.
 */
export function useDownloadSavedTrack(kind: "flow" | "shared") {
  const queryClient = useQueryClient();
  const researchTrack =
    kind === "flow" ? researchFlowTrack : researchSharedPlaylistTrack;

  return useMutation({
    mutationFn: (job: FlowJob) => researchTrack(job.playlistType, job.id),
    onMutate: async (job) => {
      await queryClient.cancelQueries({ queryKey: flowKeys.jobsAll() });
      setCachedJobStatus(queryClient, job.id, "pending");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: flowKeys.status() });
      void queryClient.invalidateQueries({ queryKey: activityKeys.list() });
    },
    onError: (err, job) => {
      setCachedJobStatus(queryClient, job.id, "saved");
      void queryClient.invalidateQueries({ queryKey: flowKeys.jobsAll() });
      toastControlError("Couldn't download the track", err);
    },
  });
}

export function confirmStopDownload(trackName: string, onStop: () => void) {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  Alert.alert("Stop Download", `Stop downloading "${trackName}"?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Stop", style: "destructive", onPress: onStop },
  ]);
}

export function useTrackJobMenu(kind: "flow" | "shared") {
  const stopMutate = useStopTrackDownload().mutate;
  const retryMutate = useRetryTrackDownload().mutate;
  const downloadMutate = useDownloadSavedTrack(kind).mutate;

  const actionsFor = useCallback((job: FlowJob): TrackMenuAction[] => {
    if (job.status === "saved") return [{ id: "download", title: "Download" }];
    const controls = flowJobControls(job.status);
    if (!controls) return [];
    const actions: TrackMenuAction[] = [
      {
        id: "retry",
        title: controls.restarts ? "Restart Download" : "Retry Download",
      },
    ];
    if (controls.canStop) {
      actions.push({ id: "stop", title: "Stop Download", destructive: true });
    }
    return actions;
  }, []);

  /** False for an action the screen handles itself. */
  const runAction = useCallback(
    (job: FlowJob, id: TrackMenuActionId) => {
      if (id === "retry") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        retryMutate(job.id);
        return true;
      }
      if (id === "stop") {
        confirmStopDownload(job.trackName, () => stopMutate(job.id));
        return true;
      }
      if (id === "download") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        downloadMutate(job);
        return true;
      }
      return false;
    },
    [retryMutate, stopMutate, downloadMutate],
  );

  return { actionsFor, runAction };
}
