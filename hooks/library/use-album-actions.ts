import { useCallback } from "react";
import { Alert } from "react-native";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import {
  invalidateFilteredLists,
  invalidateLibraryLists,
} from "@/hooks/library/library-lists";
import { canResearchAurralAlbum, isUnreleased } from "@/lib/album-status";
import { deleteAurralAlbum, researchAurralAlbum } from "@/lib/api/library";
import { libraryAlbumsRef, managedAlbumId } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";
import type {
  Album,
  DownloadStatusMap,
  DownloadStatusValue,
} from "@/lib/types/library";

/** The artist an album is listed under, so their album list rereads too. */
export type AlbumArtist = {
  id: string | undefined;
  mbid: string | undefined;
  name: string;
};

export function invalidateArtistAlbums(
  queryClient: QueryClient,
  artist: AlbumArtist,
) {
  const artistRef = libraryAlbumsRef({
    artistId: artist.id,
    artistMbid: artist.mbid,
  });
  if (artistRef) {
    void queryClient.invalidateQueries({
      queryKey: libraryKeys.albums(artistRef),
    });
  }
}

/**
 * Re-search for a Library album, as its page and its sheet offer it: only for
 * an incomplete album Aurral manages, and only with the permission it takes.
 */
export function useResearchAlbum({
  albumRef,
  album,
  artist,
  downloadStatus,
}: {
  /** The album's ref, as its page's reads key on it. */
  albumRef: string;
  /** The canonical record. Until it's read, nothing is offered. */
  album: Album | null | undefined;
  artist: AlbumArtist;
  downloadStatus: DownloadStatusValue | undefined;
}) {
  const queryClient = useQueryClient();
  const hasPermission = useHasPermission();
  const albumId = album ? managedAlbumId(album) : undefined;
  const aurralAlbum = albumId ? album : undefined;

  // Unknown reads as complete, so an album with no canonical record is not
  // offered a re-search it knows nothing about.
  const isComplete = album
    ? album.statistics.percentOfTracks >= 100 || album.statistics.sizeOnDisk > 0
    : true;
  // Re-searching an unmonitored Aurral album monitors it, which takes
  // changeMonitoring. A monitored one is requested again, which takes
  // addAlbum and names the artist.
  const canResearch =
    !!aurralAlbum &&
    canResearchAurralAlbum(aurralAlbum, downloadStatus) &&
    (aurralAlbum.monitored
      ? hasPermission("addAlbum") && !!artist.mbid && !!artist.name
      : hasPermission("changeMonitoring"));
  // Monitoring an album that isn't out yet only schedules its download.
  const label =
    aurralAlbum &&
    !aurralAlbum.monitored &&
    isUnreleased(aurralAlbum.releaseDate)
      ? "Download When It's Out"
      : "Re-search";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!albumId || !aurralAlbum) return null;
      return researchAurralAlbum(
        { ...aurralAlbum, canonicalId: albumId },
        { mbid: artist.mbid ?? "", name: artist.name },
      );
    },
    // Aurral's answer can be a release date to wait for, which a guess here
    // would have shown as Queued.
    onSuccess: (albumStatus) => {
      if (!albumStatus || !albumId) return;
      queryClient.setQueriesData<DownloadStatusMap>(
        { queryKey: libraryKeys.downloadStatusesAll() },
        (old) => ({ ...(old ?? {}), [albumId]: albumStatus }),
      );
    },
    // Settled, not success: the server can monitor the album and still answer
    // an error when queueing its tracks fails.
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.downloadStatusesAll(),
      });
      // Re-searching an unmonitored Aurral album monitored it.
      if (aurralAlbum && !aurralAlbum.monitored) {
        void queryClient.invalidateQueries({
          queryKey: libraryKeys.album(albumRef),
        });
        invalidateArtistAlbums(queryClient, artist);
        void invalidateFilteredLists(queryClient, "status");
      }
    },
  });
  const { mutate } = mutation;

  const research = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mutate();
  }, [mutate]);

  return {
    visible: !isComplete && canResearch,
    label,
    isPending: mutation.isPending,
    research,
  };
}

/**
 * Delete Album, with its files, after asking. Only an album Aurral manages
 * can go, and only with the permission.
 */
export function useDeleteAlbum({
  album,
  title,
  artist,
  onDeleted,
}: {
  album: Album | null | undefined;
  title: string;
  artist: AlbumArtist;
  /** After the delete, for a page about the album that can't stay. */
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const hasPermission = useHasPermission();
  const albumId = album ? managedAlbumId(album) : undefined;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!albumId) return;
      // Kept files would bring the album back on the next full scan.
      await deleteAurralAlbum(albumId, true);
    },
    onSuccess: () => {
      invalidateArtistAlbums(queryClient, artist);
      invalidateLibraryLists(queryClient);
      onDeleted?.();
    },
    // A sheet that asked has already closed, so the failure says so here.
    onError: (error) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Burnt.toast({
        title: "Couldn't delete album",
        message: error instanceof Error ? error.message : undefined,
        preset: "error",
      });
    },
  });
  const { mutate } = mutation;

  const confirmDelete = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const message = `Delete "${title}" and its files? Aurral won't download it again.`;
    Alert.alert("Delete Album", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => mutate() },
    ]);
  }, [title, mutate]);

  return {
    canDelete: !!albumId && hasPermission("deleteAlbum"),
    isPending: mutation.isPending,
    confirmDelete,
  };
}
