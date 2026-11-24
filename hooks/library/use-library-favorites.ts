import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import * as Burnt from "burnt";
import {
  FAVORITE_SORT_OPTIONS,
  type LibrarySongSortMode,
} from "@/components/library/AlbumSortPicker";
import type { ApiError } from "@/lib/api/client";
import {
  favoriteEntityId,
  getCanonicalLibraryPage,
  getLibraryFavorites,
  updateLibraryFavorites,
  type FavoriteKind,
  type TrackFavorite,
} from "@/lib/api/library";
import { invalidateFilteredLists } from "@/hooks/library/library-lists";
import { albumsOfPages } from "@/hooks/library/use-library-albums-all";
import { songsOfPages } from "@/hooks/library/use-song-list";
import { serverSort } from "@/lib/library-sorts";
import { libraryKeys } from "@/lib/query-keys";
import type {
  Artist,
  CanonicalPage,
  CanonicalPageKind,
  FavoriteLists,
  LibraryFavorites,
  LibraryListParams,
} from "@/lib/types/library";

/** The server's page cap. */
const PAGE_SIZE = 100;

type FavoriteOrder = Pick<LibraryListParams, "sort" | "direction">;

/** Every page of one kind of favorite. Page 1 gives the count for the rest. */
async function readFavoritePages(
  kind: CanonicalPageKind,
  order: FavoriteOrder,
  artistId: string | undefined,
): Promise<CanonicalPage[]> {
  const read = (page: number) =>
    getCanonicalLibraryPage({
      kind,
      source: "all",
      // Songs with no file can't play, and the web leaves them out too.
      availableOnly: kind === "tracks" ? true : undefined,
      page,
      pageSize: PAGE_SIZE,
      favorite: true,
      artistId,
      ...order,
    });
  const first = await read(1);
  if (!first.hasMore) return [first];
  const pageCount = Math.max(2, Math.ceil(first.total / PAGE_SIZE));
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => read(index + 2)),
  );
  return [first, ...rest];
}

/** Drops an artist an earlier page carried: offsets shift between reads. */
function artistsOfPages(pages: readonly CanonicalPage[]): Artist[] {
  const seenIds = new Set<string>();
  const artists: Artist[] = [];
  for (const artist of pages.flatMap((page) => page.artists)) {
    if (seenIds.has(artist.id)) continue;
    seenIds.add(artist.id);
    artists.push(artist);
  }
  return artists;
}

/** One artist's favorites leave out Artists: the artist is the page. */
async function getFavoriteLists(
  order: FavoriteOrder,
  artistId: string | undefined,
): Promise<FavoriteLists> {
  const [artists, albums, tracks] = await Promise.all([
    artistId ? [] : readFavoritePages("artists", order, artistId),
    readFavoritePages("albums", order, artistId),
    readFavoritePages("tracks", order, artistId),
  ]);
  return {
    artists: artistsOfPages(artists),
    albums: albumsOfPages(albums),
    tracks: songsOfPages(tracks),
  };
}

/**
 * Every favorite, by section, in `sort` order. `artistId`, a canonical id,
 * narrows them to one artist's albums and songs.
 */
export function favoriteListsQuery(
  sort: LibrarySongSortMode,
  artistId?: string,
) {
  const order = serverSort(sort);
  return queryOptions({
    queryKey: libraryKeys.favoriteLists(order, artistId),
    queryFn: () => getFavoriteLists(order, artistId),
  });
}

/**
 * The Favorites screen's sections in `sort` order, read in full so search,
 * Play and Shuffle cover every favorite. No auth guard: call it inside `(app)`.
 */
export function useLibraryFavorites(
  sort: LibrarySongSortMode,
  artistId?: string,
) {
  return useSuspenseQuery({
    ...favoriteListsQuery(sort, artistId),
    // Other clients change favorites too, so opening the screen rereads them.
    staleTime: 0,
  });
}

/**
 * How many of one Library artist's albums and songs are favorites, from the
 * read its Favorites page opens on first.
 */
export function useArtistFavoriteCounts(libraryArtistId: string | undefined) {
  const { data } = useQuery({
    ...favoriteListsQuery(FAVORITE_SORT_OPTIONS[0].key, libraryArtistId),
    staleTime: 0,
    enabled: !!libraryArtistId,
  });
  return { albums: data?.albums.length ?? 0, songs: data?.tracks.length ?? 0 };
}

/**
 * Every heart shares one cached unpaged read instead of rereading it on each
 * mount. `trackMbid` finds a library favorite playing from a flow or playlist.
 */
export function useIsFavoriteTrack(
  favorite: TrackFavorite | null,
  trackMbid: string | null,
) {
  return useQuery({
    queryKey: libraryKeys.favorites(),
    queryFn: getLibraryFavorites,
    enabled: favorite !== null,
    select: (favorites) =>
      favorite !== null && isFavoriteTrack(favorites, favorite, trackMbid),
  });
}

function isFavoriteTrack(
  favorites: LibraryFavorites,
  { kind, key }: TrackFavorite,
  trackMbid: string | null,
) {
  if (kind === "song") {
    return favorites.tracks.some((track) => track.identityKey === key);
  }
  return (
    favorites.playlistSongIds.includes(favoriteEntityId(kind, key)) ||
    (!!trackMbid &&
      favorites.tracks.some(
        (track) => track.available && track.mbid === trackMbid,
      ))
  );
}

/** Under `libraryKeys.favorites()`: the unpaged read, or the screen's lists. */
type CachedFavorites = LibraryFavorites | FavoriteLists;

function withoutFavorite(
  favorites: CachedFavorites,
  kind: FavoriteKind,
  key: string,
): CachedFavorites {
  const keep = (rowKind: FavoriteKind) => (row: { identityKey?: string }) =>
    rowKind !== kind || row.identityKey !== key;
  const lists: FavoriteLists = {
    artists: favorites.artists.filter(keep("artist")),
    albums: favorites.albums.filter(keep("album")),
    tracks: favorites.tracks.filter(keep("song")),
  };
  if (!("playlistSongIds" in favorites)) return lists;
  const removedId = favoriteEntityId(kind, key);
  return {
    ...lists,
    playlistSongIds: favorites.playlistSongIds.filter((id) => id !== removedId),
  };
}

export type ToggleFavorite = {
  kind: FavoriteKind;
  key: string;
  starred: boolean;
};

/**
 * A removal leaves every cached favorites read at once, since rereading them
 * is slow. Favorites-only Library lists reread too; other cached lists keep a
 * stale `userFavorite`, which they don't read.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const favoritesKey = libraryKeys.favorites();

  return useMutation({
    mutationKey: favoritesKey,
    mutationFn: ({ kind, key, starred }: ToggleFavorite) =>
      updateLibraryFavorites([favoriteEntityId(kind, key)], starred),
    onMutate: async ({ kind, key, starred }) => {
      await queryClient.cancelQueries({ queryKey: favoritesKey });
      const previousReads = queryClient.getQueriesData<CachedFavorites>({
        queryKey: favoritesKey,
      });
      if (!starred) {
        for (const [queryKey, favorites] of previousReads) {
          if (!favorites) continue;
          queryClient.setQueryData(
            queryKey,
            withoutFavorite(favorites, kind, key),
          );
        }
      }
      return { previousReads };
    },
    onSuccess: (_result, { starred }) => {
      Burnt.toast({
        title: starred ? "Added to Favorites" : "Removed from Favorites",
        preset: "done",
      });
    },
    onError: (error, _variables, context) => {
      for (const [queryKey, favorites] of context?.previousReads ?? []) {
        if (favorites) queryClient.setQueryData(queryKey, favorites);
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
      return Promise.all([
        ...[
          favoritesKey,
          libraryKeys.canonicalArtists(),
          libraryKeys.albumRecords(),
          libraryKeys.trackLists(),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        invalidateFilteredLists(queryClient, "favorite"),
      ]);
    },
  });
}
