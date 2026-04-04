import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { getLibraryArtist } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';

export function useLibraryArtist(mbid: string) {
  const { serverUrl, token } = useAuth();

  return useQuery({
    queryKey: libraryKeys.artist(mbid),
    queryFn: () => getLibraryArtist(mbid),
    enabled: !!mbid && !!serverUrl && !!token,
  });
}
