import { useCallback } from "react";
import { Alert } from "react-native";
import {
  useMutation,
  useMutationState,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { invalidateLibraryIndex } from "@/hooks/library/library-lists";
import { useLibraryTracks } from "@/hooks/library/use-library-tracks";
import { ApiError } from "@/lib/api/client";
import { deleteLibraryTrack } from "@/lib/api/library";
import { removeSaved } from "@/lib/offline/saved-library";
import { removeLibraryTrackFromQueue } from "@/lib/player/player";
import { libraryIdsOf, type PlayerTrack } from "@/lib/player/track-item";
import { libraryKeys, searchKeys } from "@/lib/query-keys";
import type { Track } from "@/lib/types/library";

type DeleteTrack = { trackId: string; title: string };

/** An album and its artist leave the Library with their last song. */
function invalidateDeletedTrack(queryClient: QueryClient) {
  void invalidateLibraryIndex(queryClient);
  void queryClient.invalidateQueries({
    queryKey: searchKeys.librarySearchAll(),
  });
}

/**
 * Delete from Library for one song, as the web's track delete does. Each
 * result is toasted, even once the menu's screen has closed.
 */
export function useDeleteLibraryTrack(onDeleted?: () => void) {
  const queryClient = useQueryClient();
  const hasPermission = useHasPermission();
  const deleting = useMutationState({
    filters: { mutationKey: libraryKeys.deleteTrack(), status: "pending" },
    select: (mutation) => (mutation.state.variables as DeleteTrack).trackId,
  });
  // Hook-level callbacks, because React Query drops mutate()'s own once the
  // caller unmounts.
  const { mutate } = useMutation({
    mutationKey: libraryKeys.deleteTrack(),
    mutationFn: ({ trackId }: DeleteTrack) => deleteLibraryTrack(trackId),
    onSuccess: (_result, { trackId, title }) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Burnt.toast({ title: `Deleted ${title}`, preset: "done" });
      removeLibraryTrackFromQueue(trackId).catch(() => {});
      // A copy a saved album or playlist holds goes with that save.
      void removeSaved("song", trackId);
      invalidateDeletedTrack(queryClient);
      onDeleted?.();
    },
    onError: (error, { title }) => {
      Burnt.toast({
        title: `Couldn't delete ${title}`,
        message: error instanceof ApiError ? error.message : undefined,
        preset: "error",
      });
    },
  });

  const confirmDelete = useCallback(
    (trackId: string, title: string) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Delete from Library",
        `Delete "${title}" and its file? Aurral won't download it again.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => mutate({ trackId, title }),
          },
        ],
      );
    },
    [mutate],
  );
  const isDeleting = useCallback(
    (trackId: string) => deleting.includes(trackId),
    [deleting],
  );

  return {
    // The server takes either permission, as the web does.
    canDelete: hasPermission("deleteTrack") || hasPermission("deleteAlbum"),
    confirmDelete,
    isDeleting,
  };
}

/**
 * The song's Library id when Aurral has its files to delete (read-only ones
 * answer 409), else null. A player's song reads its album, only when `enabled`.
 */
export function useDeletableTrackId(
  track: Track | null,
  item: PlayerTrack | null,
  enabled: boolean,
): string | null {
  const ids = libraryIdsOf(track?.streamPath ?? item?.streamPath ?? null);
  const trackId = track?.id ?? ids?.libraryTrackId ?? null;
  const knownSources = track?.sources;
  const { data: albumTracks } = useLibraryTracks(
    enabled && !knownSources ? ids?.libraryAlbumId : undefined,
  );
  const sources =
    knownSources ??
    albumTracks?.find((entry) => String(entry.id) === trackId)?.sources;
  return enabled && trackId && sources?.includes("aurral") ? trackId : null;
}
