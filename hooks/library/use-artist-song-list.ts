import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { LibrarySongSortMode } from "@/components/library/AlbumSortPicker";
import { useDrainRemainingPages } from "@/hooks/library/use-drain-remaining-pages";
import { compareAlbumOrder } from "@/hooks/library/use-play-library-songs";
import { songsOfPages } from "@/hooks/library/use-song-list";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { serverSort } from "@/lib/library-sorts";
import { libraryKeys } from "@/lib/query-keys";
import type { AlbumTrack } from "@/lib/types/library";

/** The server's page cap. */
const PAGE_SIZE = 100;

/**
 * Album order is the hero's Play order. The server has no such sort, so the
 * phone orders its title-sorted read and shares Name A-Z's cache.
 */
export type ArtistSongOrder = "album" | LibrarySongSortMode;

type ArtistSongListOptions = {
  order: ArtistSongOrder;
  favorite?: boolean;
  enabled?: boolean;
  /** Hand a failed first page to the route's error boundary. */
  throwOnError?: boolean;
};

/**
 * Every playable song on a Library artist's own albums, read in full: one
 * artist's songs stay few enough that the phone can filter and search them.
 * `libraryArtistId` is the canonical artist id, the only one the route
 * matches.
 */
export function useArtistSongList(
  libraryArtistId: string | undefined,
  {
    order,
    favorite = false,
    enabled = true,
    throwOnError = false,
  }: ArtistSongListOptions,
) {
  const { sort, direction } = serverSort(
    order === "album" ? "name-asc" : order,
  );
  const query = useInfiniteQuery({
    queryKey: libraryKeys.artistSongList({
      artistId: libraryArtistId ?? "",
      query: "",
      sort,
      direction,
      status: null,
      favorite,
    }),
    queryFn: ({ pageParam }) =>
      getCanonicalLibraryPage({
        kind: "tracks",
        source: "all",
        // Songs with no file can't play.
        availableOnly: true,
        page: pageParam,
        pageSize: PAGE_SIZE,
        artistId: libraryArtistId,
        sort,
        direction,
        favorite,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    throwOnError: (_error, query) =>
      throwOnError && query.state.data === undefined,
    enabled: enabled && !!libraryArtistId,
  });
  useDrainRemainingPages(query);

  const songs = useMemo((): AlbumTrack[] | undefined => {
    if (!query.data) return undefined;
    const list = songsOfPages(query.data.pages);
    return order === "album" ? list.sort(compareAlbumOrder) : list;
  }, [query.data, order]);

  return {
    /** Undefined until the first page arrives. */
    songs,
    /** True until every page is in, unless a page failed or it's off. */
    isLoading: query.isLoading || (query.hasNextPage && !query.isError),
    isError: query.isError,
    refetch: query.refetch,
  };
}
