import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { searchArtists } from '@/lib/api/search';
import { searchKeys } from '@/lib/query-keys';
import { useDebouncedValue } from './use-debounced-value';

export function useArtistSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query.trim());

  return useQuery({
    queryKey: searchKeys.artists(debouncedQuery),
    queryFn: () => searchArtists(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  });
}
