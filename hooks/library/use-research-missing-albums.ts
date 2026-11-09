import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { canResearchAurralAlbum } from "@/lib/album-status";
import {
  researchAurralAlbum,
  triggerAlbumSearch,
  updateLibraryAlbum,
} from "@/lib/api/library";
import {
  albumDownloadStatus,
  albumManager,
  albumStatusKey,
} from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";
import type { Album, DownloadStatusMap } from "@/lib/types/library";

const LIDARR_ACTIVE_STATUSES = new Set([
  "adding",
  "searching",
  "downloading",
  "moving",
  "processing",
]);

/** Mirrors the web's handleReSearchMissingDownloads. */
export function getEligibleMissingAlbums(
  albums: Album[] | undefined,
  downloadStatuses: DownloadStatusMap | undefined,
): Album[] {
  if (!albums) return [];
  return albums.filter((album) => {
    const manager = albumManager(album);
    if (!manager) return false;

    const { percentOfTracks, sizeOnDisk } = album.statistics;
    const isComplete = percentOfTracks >= 100 || sizeOnDisk > 0;
    if (isComplete) return false;

    const status = albumDownloadStatus(downloadStatuses, album);
    if (manager.name === "aurral") {
      // Aurral leaves an unmonitored album's tracks out of its status, so only
      // a monitored album reads failed. Requesting one again needs only the
      // addAlbum this action is offered for.
      return album.monitored && canResearchAurralAlbum(album, status);
    }
    if (status && LIDARR_ACTIVE_STATUSES.has(status)) return false;

    return status === "failed" || album.monitored;
  });
}

export function useResearchMissingAlbums(
  albums: Album[] | undefined,
  downloadStatuses: DownloadStatusMap | undefined,
  artist: { mbid: string; name: string },
) {
  const queryClient = useQueryClient();

  const eligibleAlbums = useMemo(
    () => getEligibleMissingAlbums(albums, downloadStatuses),
    [albums, downloadStatuses],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const lidarrAlbums: (Album & { lidarrId: string })[] = [];
      const aurralAlbums: (Album & { canonicalId: string })[] = [];
      for (const album of eligibleAlbums) {
        const manager = albumManager(album);
        if (manager?.name === "lidarr") {
          lidarrAlbums.push({ ...album, lidarrId: manager.albumId });
        } else if (manager?.name === "aurral") {
          aurralAlbums.push({ ...album, canonicalId: manager.albumId });
        }
      }
      // Force-monitor unmonitored albums first so Lidarr will search them.
      for (const album of lidarrAlbums) {
        if (!album.monitored) {
          await updateLibraryAlbum(album.lidarrId, { monitored: true });
        }
      }
      await Promise.all([
        ...lidarrAlbums.map((album) => triggerAlbumSearch(album.lidarrId)),
        ...aurralAlbums.map((album) =>
          researchAurralAlbum(album, {
            mbid: album.artistMbid || artist.mbid,
            name: album.artistName || artist.name,
          }),
        ),
      ]);
      return eligibleAlbums.length;
    },
    onMutate: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      queryClient.setQueriesData<DownloadStatusMap>(
        { queryKey: libraryKeys.downloadStatusesAll() },
        (old) => {
          const next = { ...(old ?? {}) };
          for (const album of eligibleAlbums) {
            const key = albumStatusKey(album);
            if (!key) continue;
            next[key] = {
              status: album.managedBy === "aurral" ? "queued" : "searching",
            };
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
