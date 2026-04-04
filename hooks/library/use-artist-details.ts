import { useQuery } from '@tanstack/react-query';
import { getArtistDetails } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';

export function useArtistDetails(mbid: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.artistDetails(mbid!),
    queryFn: () => getArtistDetails(mbid!),
    enabled: !!mbid,
    staleTime: 30 * 60 * 1000,
  });
}
