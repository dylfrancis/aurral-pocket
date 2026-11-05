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

/**
 * Each sort option as /library/canonical takes it, mirroring the web's albums
 * tab. The server reverses direction for `newest`, so `asc` lists the most
 * recently added first.
 */
const SORTS: Record<
  LibraryAlbumSortMode,
  Pick<LibraryAlbumsParams, "sort" | "direction">
> = {
  "name-asc": { sort: "name", direction: "asc" },
  "name-desc": { sort: "name", direction: "desc" },
  "artist-asc": { sort: "artist", direction: "asc" },
  "artist-desc": { sort: "artist", direction: "desc" },
  newest: { sort: "newest", direction: "asc" },
};

/**
 * Search, sort and paging for a whole-library album grid. The server does
 * the searching and sorting, so this holds the view and feeds it to
 * useLibraryAlbumsAll. The genre screen passes its genre; the albums screen
 * passes nothing.
 *
 * Search text goes to the server once typing stops for 250 ms.
 */
export function useAlbumGrid({ genre = "" }: { genre?: string } = {}) {
  const [sortMode, setSortMode] = useState<LibraryAlbumSortMode>("name-asc");
  const [searchQuery, setSearchQuery] = useState("");
  const trimmed = searchQuery.trim();
  const query = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);

  const params = useMemo<LibraryAlbumsParams>(
    () => ({ genre, query, ...SORTS[sortMode] }),
    [genre, query, sortMode],
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
    // Empty while a newer search is still being typed or fetched: the albums
    // on screen are then an older search's, and naming the new one over them
    // would claim it found nothing before it has run.
    resultsQuery: !isPlaceholderData && query === trimmed ? query : "",
    // The server only returns matches, so an empty search result cannot tell
    // an empty library from no matches. While a search is set, report the
    // library as non-empty, so the grid says "No results" rather than "No
    // albums".
    hasUnderlyingItems: query !== "" || items.length > 0,
  };
}
