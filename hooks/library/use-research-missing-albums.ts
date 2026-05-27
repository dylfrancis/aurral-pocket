import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { triggerAlbumSearch, updateLibraryAlbum } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { Album, DownloadStatusMap } from "@/lib/types/library";

// Statuses that mean a download is already in flight, so re-searching is a no-op.
const ACTIVE_STATUSES = new Set([
  "adding",
  "searching",
  "downloading",
  "moving",
  "processing",
]);

/**
 * Albums eligible for a bulk re-search: real (non-pending) albums that are
 * incomplete, not already mid-download, and either previously failed or
 * monitored. Mirrors aurral's handleReSearchMissingDownloads (PR #295).
 */
export function getEligibleMissingAlbums(
  albums: Album[] | undefined,
  downloadStatuses: DownloadStatusMap | undefined,
): Album[] {
  if (!albums) return [];
  return albums.filter((album) => {
    const albumId = String(album.id ?? "");
    if (!albumId || albumId.startsWith("pending-")) return false;

    const { percentOfTracks, sizeOnDisk } = album.statistics;
    const isComplete = percentOfTracks >= 100 || sizeOnDisk > 0;
    if (isComplete) return false;

    const status = downloadStatuses?.[album.id]?.status;
    if (status && ACTIVE_STATUSES.has(status)) return false;

    return status === "failed" || album.monitored;
  });
}

export function useResearchMissingAlbums(
  albums: Album[] | undefined,
  downloadStatuses: DownloadStatusMap | undefined,
) {
  const queryClient = useQueryClient();

  const eligibleAlbums = useMemo(
    () => getEligibleMissingAlbums(albums, downloadStatuses),
    [albums, downloadStatuses],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      // Force-monitor unmonitored albums first so Lidarr will search them.
      for (const album of eligibleAlbums) {
        if (!album.monitored) {
          await updateLibraryAlbum(album.id, { ...album, monitored: true });
        }
      }
      await Promise.all(
        eligibleAlbums.map((album) => triggerAlbumSearch(album.id)),
      );
      return eligibleAlbums.length;
    },
    onMutate: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      queryClient.setQueriesData<DownloadStatusMap>(
        { queryKey: libraryKeys.downloadStatusesAll() },
        (old) => {
          const next = { ...(old ?? {}) };
          for (const album of eligibleAlbums) {
            next[album.id] = { status: "searching" };
          }
          return next;
        },
      );
    },
    onSuccess: (count) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Burnt.toast({
        title: `Re-searching ${count} album${count === 1 ? "" : "s"}`,
        preset: "done",
      });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Burnt.toast({
        title: "Couldn't re-search albums",
        preset: "error",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.downloadStatusesAll(),
      });
    },
  });

  return {
    missingCount: eligibleAlbums.length,
    researchMissing: mutation.mutate,
    isResearching: mutation.isPending,
  };
}
