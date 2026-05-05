import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchAlbums } from "@/lib/api/search";
import { searchKeys } from "@/lib/query-keys";
import { useDebouncedValue } from "./use-debounced-value";

export function useAlbumSearch(query: string, limit = 24) {
  const debouncedQuery = useDebouncedValue(query.trim());

  return useQuery({
    queryKey: searchKeys.albums(debouncedQuery),
    queryFn: () => searchAlbums(debouncedQuery, limit),
    enabled: debouncedQuery.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  });
}
