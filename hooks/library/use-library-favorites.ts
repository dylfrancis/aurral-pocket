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
    // Other clients change favorites too, so opening the screen rereads them.
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
 * A removal leaves the list at once, because the unpaged reread can be slow.
 * `userFavorite` still goes stale in the cached album and artist lists, which
 * don't read it.
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
      const previousFavorites =
        queryClient.getQueryData<LibraryFavorites>(favoritesKey);
      if (previousFavorites && !starred) {
        queryClient.setQueryData(
          favoritesKey,
          withoutFavorite(previousFavorites, kind, identityKey),
        );
      }
      return { previousFavorites };
    },
    onSuccess: (_result, { starred }) => {
      Burnt.toast({
        title: starred ? "Added to Favorites" : "Removed from Favorites",
        preset: "done",
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(favoritesKey, context.previousFavorites);
      }
      Burnt.toast({
        title: "Couldn't update favorites",
        message: (error as ApiError)?.message,
        preset: "error",
      });
    },
    // Returned so the toggle stays pending until the reread lands.
    onSettled: () => {
      // A reread before another toggle's request lands would bring its row back.
      if (queryClient.isMutating({ mutationKey: favoritesKey }) > 1) return;
      return Promise.all(
        [
          favoritesKey,
          libraryKeys.canonicalArtists(),
          libraryKeys.albumRecords(),
          libraryKeys.trackLists(),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });
}
