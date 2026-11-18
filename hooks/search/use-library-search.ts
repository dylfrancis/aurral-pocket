import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchLibrary } from "@/lib/api/search";
import { searchKeys } from "@/lib/query-keys";
import { useDebouncedValue } from "./use-debounced-value";

/**
 * Library songs and the user's own playlists that match `query`. Search and
 * its results share one answer, since one request returns all of them.
 */
export function useLibrarySearch(query: string) {
  const debouncedQuery = useDebouncedValue(query.trim());

  return useQuery({
    queryKey: searchKeys.songsAndPlaylists(debouncedQuery),
    queryFn: () => searchLibrary(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    placeholderData: keepPreviousData,
    // Downloads add songs while the screen is open.
    staleTime: 15 * 1000,
  });
}
