import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import type { TrackDownloadState } from "@/components/discover/BrowseTrackRow";
import type { EditorialTrackItem } from "@/components/discover/EditorialTrackRow";
import { ApiError } from "@/lib/api/client";
import { requestTrackDownload } from "@/lib/api/library";
import { mapWithLimit } from "@/lib/map-with-limit";
import type { EditorialTrack } from "@/lib/types/search";

const DOWNLOAD_CONCURRENCY = 3;

function requestDownload(track: EditorialTrack) {
  return requestTrackDownload({
    artistName: track.artistName,
    trackName: track.trackName,
    albumName: track.albumName,
  });
}

const formatSongCount = (count: number) =>
  `${count} song${count === 1 ? "" : "s"}`;

/**
 * Asks the server to download a playlist's songs the Library lacks, one at a
 * time from a row's ↓ or all at once. Each song remembers its request, so a
 * second tap can't ask twice.
 */
export function usePlaylistDownloads(items: readonly EditorialTrackItem[]) {
  const [states, setStates] = useState<Record<string, TrackDownloadState>>({});
  const setState = (id: string, state: TrackDownloadState) =>
    setStates((current) => ({ ...current, [id]: state }));

  const singleDownload = useMutation({
    mutationFn: (item: EditorialTrackItem) => requestDownload(item.track),
    onMutate: (item) => setState(item.id, "sending"),
    onSuccess: (result, item) => {
      setState(item.id, "queued");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Android shows only a toast's title, so the song goes there.
      Burnt.toast({
        title: result.alreadyOwned
          ? `${item.track.trackName} is in your Library`
          : `Downloading ${item.track.trackName}`,
        preset: "done",
      });
    },
    onError: (requestError, item) => {
      setState(item.id, "idle");
      Burnt.toast({
        title: "Couldn't download this song",
        message:
          requestError instanceof ApiError ? requestError.message : undefined,
        preset: "error",
      });
    },
  });

  const bulkDownload = useMutation({
    mutationFn: async (missing: EditorialTrackItem[]) => {
      const results = await mapWithLimit(
        missing,
        DOWNLOAD_CONCURRENCY,
        async (item) => {
          setState(item.id, "sending");
          try {
            const result = await requestDownload(item.track);
            setState(item.id, "queued");
            return result.alreadyOwned ? "owned" : "queued";
          } catch {
            setState(item.id, "idle");
            return "failed";
          }
        },
      );
      const count = (outcome: string) =>
        results.filter((result) => result === outcome).length;
      return { queued: count("queued"), failed: count("failed") };
    },
    onSuccess: ({ queued, failed }) => {
      void Haptics.notificationAsync(
        failed > 0 && queued === 0
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Success,
      );
      // Android shows only a toast's title, so the counts go there.
      Burnt.toast(
        failed === 0
          ? {
              title:
                queued > 0
                  ? `Downloading ${formatSongCount(queued)}`
                  : "These songs are in your Library",
              preset: "done",
            }
          : queued > 0
            ? {
                title: `Downloading ${formatSongCount(queued)}, ${failed} failed`,
                preset: "done",
              }
            : { title: "Couldn't download these songs", preset: "error" },
      );
    },
  });

  // A song asked for already, or on its way, isn't asked for again.
  const missing = items.filter(
    (item) => !item.track.owned && (states[item.id] ?? "idle") === "idle",
  );

  const requestOne = singleDownload.mutate;
  const downloadOne = useCallback(
    (item: EditorialTrackItem) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      requestOne(item);
    },
    [requestOne],
  );
  const downloadMissing = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    bulkDownload.mutate(missing);
  };

  return {
    states,
    downloadOne,
    downloadMissing,
    missingCount: missing.length,
    isDownloadingMissing: bulkDownload.isPending,
  };
}
