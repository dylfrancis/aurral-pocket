import { useCallback, useMemo, useState } from "react";
import {
  LIBRARY_ALBUM_SORT_OPTIONS,
  type LibraryAlbumSortMode,
} from "@/components/library/AlbumSortPicker";
import { useLibraryAlbumsAll } from "@/hooks/library/use-library-albums-all";
import {
  offeredSort,
  sortsFor,
  useLibraryView,
  type LibraryShow,
} from "@/hooks/library/use-library-view";
import { useDebouncedValue } from "@/hooks/search/use-debounced-value";
import { serverSort } from "@/lib/library-sorts";
import type { LibraryAlbumsParams } from "@/lib/types/library";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

/** The web library's search debounce (QUERY_DEBOUNCE_MS in LibraryPage). */
const SEARCH_DEBOUNCE_MS = 250;

const ALBUM_SORTS = LIBRARY_ALBUM_SORT_OPTIONS.map((option) => option.key);

// A genre can't show what's saved offline: a save doesn't keep its genres.
const LIBRARY_SHOWS: LibraryShow[] = ["all", "favorites", "saved"];
const GENRE_SHOWS: LibraryShow[] = ["all", "favorites"];

/**
 * Search, sort, filters and paging for a whole-library album grid. The sort
 * and filters are remembered: one choice for the Albums list, one shared by
 * every genre. `openedSort` opens the grid on a sort without remembering it.
 */
export function useAlbumGrid({
  genre = "",
  openedSort,
}: { genre?: string; openedSort?: string } = {}) {
  const { view, setSort, setShow, setStatus } = useLibraryView(
    genre ? "genre-albums" : "library-albums",
    ALBUM_SORTS,
    genre ? GENRE_SHOWS : LIBRARY_SHOWS,
    ALBUM_SORTS.find((sort) => sort === openedSort),
  );
  const sortOptions = useMemo(
    () => sortsFor(LIBRARY_ALBUM_SORT_OPTIONS, view.show),
    [view.show],
  );
  const sortMode = offeredSort(sortOptions, view.sort);

  const [searchQuery, setSearchQuery] = useState("");
  const typedQuery = searchQuery.trim();
  const debouncedQuery = useDebouncedValue(typedQuery, SEARCH_DEBOUNCE_MS);

  const params = useMemo<LibraryAlbumsParams>(
    () => ({
      genre,
      query: debouncedQuery,
      ...serverSort(sortMode),
      status: view.status,
      favorite: view.show === "favorites",
    }),
    [genre, debouncedQuery, sortMode, view.status, view.show],
  );
  const {
    data,
    isPending,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useLibraryAlbumsAll(params);

  const { refreshing, onRefresh: handleRefresh } = usePullToRefresh(refetch);

  // Picking Random again deals a new order: the server shuffles every read.
  const chooseSort = useCallback(
    (mode: LibraryAlbumSortMode) => {
      if (mode === "random" && sortMode === "random") void refetch();
      else setSort(mode);
    },
    [sortMode, refetch, setSort],
  );

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
    setSortMode: chooseSort,
    sortOptions,
    show: view.show,
    setShow,
    status: view.status,
    setStatus,
    setSearchQuery,
    /** What's typed, for a list searched on the phone. */
    typedQuery,
    // The search the albums on screen answer, for the "No results" message.
    // Empty while a newer one is pending, so it never names a search early.
    settledQuery:
      !isPlaceholderData && debouncedQuery === typedQuery ? debouncedQuery : "",
    // An empty search result can't tell an empty library from no matches.
    hasUnderlyingItems: debouncedQuery !== "" || items.length > 0,
  };
}
