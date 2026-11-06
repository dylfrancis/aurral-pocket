import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import * as Burnt from "burnt";
import type { ApiError } from "@/lib/api/client";
import {
  favoriteEntityId,
  getLibraryFavorites,
  updateLibraryFavorites,
  type FavoriteKind,
} from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { LibraryFavorites } from "@/lib/types/library";

/** Has no auth guard, so call it only inside the `(app)` route group. */
export function useLibraryFavorites() {
  return useSuspenseQuery({
    queryKey: libraryKeys.favorites(),
    queryFn: getLibraryFavorites,
    // The web UI and Subsonic clients change favorites too, so opening the
    // screen rereads them behind whatever is cached.
    staleTime: 0,
  });
}

/** Shares the list's cache, without rereading the unpaged payload on every mount. */
export function useIsFavoriteTrack(identityKey: string) {
  return useQuery({
    queryKey: libraryKeys.favorites(),
    queryFn: getLibraryFavorites,
    select: (favorites) =>
      favorites.tracks.some((track) => track.identityKey === identityKey),
  });
}

function withoutFavorite(
  favorites: LibraryFavorites,
  kind: FavoriteKind,
  identityKey: string,
): LibraryFavorites {
  const keep = (rowKind: FavoriteKind) => (row: { identityKey?: string }) =>
    rowKind !== kind || row.identityKey !== identityKey;
  return {
    artists: favorites.artists.filter(keep("artist")),
    albums: favorites.albums.filter(keep("album")),
    tracks: favorites.tracks.filter(keep("song")),
  };
}

type ToggleFavorite = {
  kind: FavoriteKind;
  identityKey: string;
  starred: boolean;
};

/**
 * Star or unstar one artist, album or track, and say what happened.
 *
 * A removal leaves the favorites list at once, because the reread can take a
 * moment: the payload is unpaged and carries starred artists' discographies.
 *
 * The album page and its track list read `userFavorite`, so a toggle refreshes
 * both. The flag still goes stale in the cached album and artist lists, which
 * do not read it.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const favoritesKey = libraryKeys.favorites();

  return useMutation({
    mutationKey: favoritesKey,
    mutationFn: ({ kind, identityKey, starred }: ToggleFavorite) =>
      updateLibraryFavorites([favoriteEntityId(kind, identityKey)], starred),
    onMutate: async ({ kind, identityKey, starred }) => {
      await queryClient.cancelQueries({ queryKey: favoritesKey });
      const previous = queryClient.getQueryData<LibraryFavorites>(favoritesKey);
      if (previous && !starred) {
        queryClient.setQueryData(
          favoritesKey,
          withoutFavorite(previous, kind, identityKey),
        );
      }
      return { previous };
    },
    onSuccess: (_result, { starred }) => {
      Burnt.toast({
        title: starred ? "Added to Favorites" : "Removed from Favorites",
        preset: "done",
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoritesKey, context.previous);
      }
      Burnt.toast({
        title: "Couldn't update favorites",
        message: (error as ApiError)?.message,
        preset: "error",
      });
    },
    // Returned so the toggle stays pending until the flags are fresh, which
    // keeps the album menu from offering the old action after the toast.
    onSettled: () => {
      // A reread that lands before another toggle's request would bring that
      // row back, so the last toggle to settle rereads for all of them.
      if (queryClient.isMutating({ mutationKey: favoritesKey }) > 1) return;
      return Promise.all(
        [
          favoritesKey,
          libraryKeys.albumRecords(),
          libraryKeys.trackLists(),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });
}
