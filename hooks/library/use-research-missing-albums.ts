import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { canResearchAurralAlbum } from "@/lib/album-status";
import { researchAurralAlbum } from "@/lib/api/library";
import { albumDownloadStatus, managedAlbumId } from "@/lib/library-read";
import { invalidateFilteredLists } from "@/hooks/library/library-lists";
import { libraryKeys } from "@/lib/query-keys";
import type { Album, DownloadStatusMap } from "@/lib/types/library";

/** Mirrors the web's handleReSearchMissingDownloads. */
export function getEligibleMissingAlbums(
  albums: Album[] | undefined,
  downloadStatuses: DownloadStatusMap | undefined,
): (Album & { canonicalId: string })[] {
  if (!albums) return [];
  return albums.flatMap((album) => {
    const albumId = managedAlbumId(album);
    if (!albumId) return [];

    const { percentOfTracks, sizeOnDisk } = album.statistics;
    const isComplete = percentOfTracks >= 100 || sizeOnDisk > 0;
    if (isComplete) return [];

    // Aurral leaves an unmonitored album's tracks out of its status, so only
    // a monitored album reads failed. Requesting one again needs only the
    // addAlbum this action is offered for.
    const status = albumDownloadStatus(downloadStatuses, album);
    return album.monitored && canResearchAurralAlbum(album, status)
      ? [{ ...album, canonicalId: albumId }]
      : [];
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
      await Promise.all(
        eligibleAlbums.map((album) =>
          researchAurralAlbum(album, {
            mbid: album.artistMbid || artist.mbid,
            name: album.artistName || artist.name,
          }),
        ),
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
            next[album.canonicalId] = { status: "queued" };
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
      // Re-searching an unmonitored album monitored it.
      void invalidateFilteredLists(queryClient, "status");
    },
  });

  return {
    missingCount: eligibleAlbums.length,
    researchMissing: mutation.mutate,
    isResearching: mutation.isPending,
  };
}
