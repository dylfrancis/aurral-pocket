import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchArtists } from "@/lib/api/search";
import { searchKeys } from "@/lib/query-keys";
import type { UnifiedSearchMode } from "@/lib/types/search";
import { useDebouncedValue } from "./use-debounced-value";

/**
 * `mode` mirrors Aurral's own split: `suggest` for as-you-type results, `full`
 * for screens where the user is waiting on a considered answer. `full` searches
 * upstream providers and returns more, at the cost of latency, so it is wrong
 * for a field that re-queries on every keystroke.
 */
export function useArtistSearch(
  query: string,
  mode: UnifiedSearchMode = "suggest",
) {
  const debouncedQuery = useDebouncedValue(query.trim());

  return useQuery({
    queryKey: searchKeys.artists(debouncedQuery, mode),
    queryFn: () => searchArtists(debouncedQuery, { mode }),
    enabled: debouncedQuery.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  });
}
