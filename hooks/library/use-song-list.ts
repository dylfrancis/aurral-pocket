import { useCallback, useMemo, useState } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { LIBRARY_SONG_SORT_OPTIONS } from "@/components/library/AlbumSortPicker";
import { useAuth } from "@/contexts/auth-context";
import {
  offeredSort,
  sortsFor,
  useLibraryView,
  type LibraryShow,
} from "@/hooks/library/use-library-view";
import { useDebouncedValue } from "@/hooks/search/use-debounced-value";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { withPageArtist } from "@/lib/library-read";
import { serverSort } from "@/lib/library-sorts";
import { libraryIdsOf } from "@/lib/player/track-item";
import { libraryKeys } from "@/lib/query-keys";
import type {
  AlbumTrack,
  CanonicalPage,
  LibraryListParams,
} from "@/lib/types/library";

/** The server's page cap. */
const PAGE_SIZE = 100;

/** The web library's search debounce (QUERY_DEBOUNCE_MS in LibraryPage). */
const SEARCH_DEBOUNCE_MS = 250;

const SONG_SORTS = LIBRARY_SONG_SORT_OPTIONS.map((option) => option.key);
const SONG_SHOWS: LibraryShow[] = ["all", "favorites"];

/**
 * Flatten the pages, giving each song the album it streams from, named by the
 * page's related artists as the album grid's cards are. Drops a song an
 * earlier page carried: offsets shift when the library changes between reads.
 */
function flattenSongPages(data: InfiniteData<CanonicalPage>): AlbumTrack[] {
  const seenIds = new Set<string>();
  const songs: AlbumTrack[] = [];
  for (const page of data.pages) {
    const artistsById = new Map(page.artists.map((a) => [a.id, a]));
    const albumsById = new Map(page.albums.map((a) => [a.id, a]));
    for (const track of page.tracks) {
      if (seenIds.has(track.id)) continue;
      seenIds.add(track.id);
      const albumId = libraryIdsOf(track.streamPath ?? null)?.libraryAlbumId;
      const album = albumId ? albumsById.get(albumId) : undefined;
      songs.push({
        ...track,
        album: album && withPageArtist(album, artistsById),
      });
    }
  }
  return songs;
}

/**
 * Every playable song in the Library, searched, sorted and filtered by the
 * server and read one page at a time as the screen asks, like the album grid.
 * The sort and filters are remembered.
 */
export function useSongList() {
  const { serverUrl, token } = useAuth();
  const { view, setSort, setShow, setStatus } = useLibraryView(
    "library-songs",
    SONG_SORTS,
    SONG_SHOWS,
  );
  const sortOptions = useMemo(
    () => sortsFor(LIBRARY_SONG_SORT_OPTIONS, view.show),
    [view.show],
  );
  const sortMode = offeredSort(sortOptions, view.sort);

  const [searchQuery, setSearchQuery] = useState("");
  const typedQuery = searchQuery.trim();
  const debouncedQuery = useDebouncedValue(typedQuery, SEARCH_DEBOUNCE_MS);

  const params = useMemo<LibraryListParams>(
    () => ({
      query: debouncedQuery,
      ...serverSort(sortMode),
      status: view.status,
      favorite: view.show === "favorites",
    }),
    [debouncedQuery, sortMode, view.status, view.show],
  );
  const {
    data,
    isPending,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: libraryKeys.songs(params),
    queryFn: ({ pageParam }) =>
      getCanonicalLibraryPage({
        kind: "tracks",
        source: "all",
        // Songs with no file can't play, and the web leaves them out too.
        availableOnly: true,
        page: pageParam,
        pageSize: PAGE_SIZE,
        query: params.query,
        sort: params.sort,
        direction: params.direction,
        status: params.status,
        favorite: params.favorite,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    select: flattenSongPages,
    placeholderData: keepPreviousData,
    throwOnError: (_error, query) => query.state.data === undefined,
    enabled: !!serverUrl && !!token,
  });

  const { refreshing, onRefresh: handleRefresh } = usePullToRefresh(refetch);

  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items = data ?? [];

  return {
    items,
    isLoading: isPending,
    refreshing,
    handleRefresh,
    loadMore,
    isFetchingNextPage,
    sortMode,
    setSortMode: setSort,
    sortOptions,
    show: view.show,
    setShow,
    status: view.status,
    setStatus,
    setSearchQuery,
    // The search the songs on screen answer, for the "No results" message.
    settledQuery:
      !isPlaceholderData && debouncedQuery === typedQuery ? debouncedQuery : "",
    hasUnderlyingItems: debouncedQuery !== "" || items.length > 0,
  };
}
