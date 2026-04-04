import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { getLibraryArtists } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';

export function useLibraryArtists() {
  const { serverUrl, token } = useAuth();

  return useQuery({
    queryKey: libraryKeys.artists(),
    queryFn: getLibraryArtists,
    enabled: !!serverUrl && !!token,
  });
}
