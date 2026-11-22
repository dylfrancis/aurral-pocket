import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchCatalog } from "@/lib/api/search";
import { searchKeys } from "@/lib/query-keys";
import { useDebouncedValue } from "./use-debounced-value";

const FRESH_MS = 5 * 60 * 1000;

/** Catalog artists and albums for a search, and whether the catalog answered. */
export function useCatalogSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query.trim());

  return useQuery({
    queryKey: searchKeys.catalog(debouncedQuery),
    queryFn: () => searchCatalog(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    placeholderData: keepPreviousData,
    // An answer from an outage is asked again on the next look.
    staleTime: (query) =>
      query.state.data?.status === "unavailable" ? 0 : FRESH_MS,
    retry: 2,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  });
}
