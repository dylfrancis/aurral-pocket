import { useCallback } from "react";
import {
  useMutation,
  useMutationState,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { cachedJob } from "@/hooks/flow/use-track-job-controls";
import { ApiError } from "@/lib/api/client";
import {
  requestTrackDownload,
  type TrackDownloadRequest,
  type TrackDownloadResult,
} from "@/lib/api/library";
import { activityKeys, flowKeys, libraryKeys } from "@/lib/query-keys";
import type { FlowJob } from "@/lib/types/flow";

type AddTrack = {
  /** The player track's id, which is the job id for a flow track. */
  trackId: string;
  track: TrackDownloadRequest;
};

/** Android shows only a toast's title, so the song goes there. */
function resultTitle(trackName: string, result: TrackDownloadResult) {
  if (result.alreadyOwned) return `${trackName} is in your Library`;
  if (result.queued) return `Adding ${trackName} to your Library`;
  return `Added ${trackName} to your Library`;
}

/** The release the flow picked comes along, so a download looks for it. */
export function jobLibraryRequest(job: FlowJob): TrackDownloadRequest {
  return {
    artistName: job.artistName,
    trackName: job.trackName,
    albumName: job.albumName,
    artistMbid: job.artistMbid,
    albumMbid: job.albumMbid,
    trackMbid: job.trackMbid,
    releaseMbid: job.releaseMbid,
    releaseYear: job.releaseYear,
    durationMs: job.durationMs,
    trackNumber: job.trackNumber,
    discNumber: job.discNumber,
    albumTrackCount: job.albumTrackCount,
    albumTrackTitles: job.albumTrackTitles,
  };
}

/**
 * The server counts a moved file as owned only once its scan finishes, about
 * a second later, and no playlist push follows. A refetch now, or one already
 * running, would offer Add to Library again.
 */
async function markJobOwned(queryClient: QueryClient, jobId: string) {
  await queryClient.cancelQueries({ queryKey: flowKeys.jobsAll() });
  queryClient.setQueriesData<FlowJob[]>(
    { queryKey: flowKeys.jobsAll() },
    (jobs) =>
      jobs?.map((job) =>
        job.id === jobId ? { ...job, libraryOwned: true } : job,
      ),
  );
}

/** Each result is toasted, even once the menu's screen has closed. */
export function useAddTrackToLibrary() {
  const queryClient = useQueryClient();
  const hasPermission = useHasPermission();
  const sending = useMutationState({
    filters: { mutationKey: libraryKeys.addTrack(), status: "pending" },
    select: (mutation) => (mutation.state.variables as AddTrack).trackId,
  });
  // Hook-level callbacks, because React Query drops mutate()'s own once the
  // caller unmounts.
  const { mutate } = useMutation({
    mutationKey: libraryKeys.addTrack(),
    mutationFn: ({ track }: AddTrack) => requestTrackDownload(track),
    onSuccess: async (result, { trackId, track }) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Burnt.toast({
        title: resultTitle(track.trackName, result),
        preset: "done",
      });
      void queryClient.invalidateQueries({ queryKey: activityKeys.feedAll() });
      // A queued download leaves the song unowned until it finishes.
      if (result.alreadyOwned || result.reused) {
        await markJobOwned(queryClient, trackId);
      }
    },
    onError: (error, { track }) => {
      Burnt.toast({
        title: `Couldn't add ${track.trackName} to your Library`,
        message: error instanceof ApiError ? error.message : undefined,
        preset: "error",
      });
    },
  });

  const add = useCallback(
    (trackId: string, track: TrackDownloadRequest) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      mutate({ trackId, track });
    },
    [mutate],
  );
  const isSending = useCallback(
    (trackId: string) => sending.includes(trackId),
    [sending],
  );
  // Read from the cache, not subscribed to it: a screen that adds from here
  // renders again as the add settles.
  const loadedJob = useCallback(
    (jobId: string) => cachedJob(queryClient, jobId),
    [queryClient],
  );

  return { canAdd: hasPermission("addAlbum"), add, isSending, loadedJob };
}
