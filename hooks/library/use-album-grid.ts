import { useCallback, useMemo, useState } from "react";
import {
  LIBRARY_ALBUM_SORT_OPTIONS,
  type LibraryAlbumSortMode,
} from "@/components/library/AlbumSortPicker";
import { useLibraryAlbumsAll } from "@/hooks/library/use-library-albums-all";
import { useDebouncedValue } from "@/hooks/search/use-debounced-value";
import type { LibraryAlbumsParams } from "@/lib/types/library";

/** The web library's search debounce (QUERY_DEBOUNCE_MS in LibraryPage). */
const SEARCH_DEBOUNCE_MS = 250;

// The server reverses direction for `newest`, so `asc` is newest first.
const SERVER_SORTS: Record<
  LibraryAlbumSortMode,
  Pick<LibraryAlbumsParams, "sort" | "direction">
> = {
  "name-asc": { sort: "name", direction: "asc" },
  "name-desc": { sort: "name", direction: "desc" },
  "artist-asc": { sort: "artist", direction: "asc" },
  "artist-desc": { sort: "artist", direction: "desc" },
  newest: { sort: "newest", direction: "asc" },
};

/** Search, sort and paging for a whole-library album grid. */
export function useAlbumGrid({ genre = "" }: { genre?: string } = {}) {
  const [sortMode, setSortMode] = useState<LibraryAlbumSortMode>("name-asc");
  const [searchQuery, setSearchQuery] = useState("");
  const typedQuery = searchQuery.trim();
  const debouncedQuery = useDebouncedValue(typedQuery, SEARCH_DEBOUNCE_MS);

  const params = useMemo<LibraryAlbumsParams>(
    () => ({ genre, query: debouncedQuery, ...SERVER_SORTS[sortMode] }),
    [genre, debouncedQuery, sortMode],
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

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
    setSortMode,
    sortOptions: LIBRARY_ALBUM_SORT_OPTIONS,
    setSearchQuery,
    // The search the albums on screen answer, for the "No results" message.
    // Empty while a newer one is pending, so it never names a search early.
    settledQuery:
      !isPlaceholderData && debouncedQuery === typedQuery ? debouncedQuery : "",
    // An empty search result can't tell an empty library from no matches.
    hasUnderlyingItems: debouncedQuery !== "" || items.length > 0,
  };
}
