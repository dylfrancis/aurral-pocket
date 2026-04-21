import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getTagSuggestions } from "@/lib/api/search";
import { searchKeys } from "@/lib/query-keys";
import { useDebouncedValue } from "./use-debounced-value";

export function useTagSuggestions(query: string) {
  const debouncedQuery = useDebouncedValue(query.trim());

  return useQuery({
    queryKey: searchKeys.tagSuggestions(debouncedQuery),
    queryFn: () => getTagSuggestions(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
  });
}
