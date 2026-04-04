import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getArtistReleaseGroups } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';
import type { Album, PrimaryReleaseType, SecondaryReleaseType, ReleaseGroup } from '@/lib/types/library';

/**
 * Fetches MusicBrainz release groups for an artist and enriches
 * library albums with primary type and secondary types by matching MBIDs.
 */
export function useAlbumsWithTypes(
  mbid: string | undefined,
  albums: Album[] | undefined,
) {
  const rgQuery = useQuery({
    queryKey: libraryKeys.releaseGroups(mbid!),
    queryFn: () => getArtistReleaseGroups(mbid!),
    enabled: !!mbid,
    staleTime: 10 * 60 * 1000,
  });

  const enriched = useMemo(() => {
    if (!albums) return undefined;
    if (!rgQuery.data) {
      // No release group data yet — default all to Album
      return albums.map((a) => ({
        ...a,
        albumType: 'Album' as PrimaryReleaseType,
        secondaryTypes: [] as SecondaryReleaseType[],
      }));
    }

    const rgMap = new Map<string, ReleaseGroup>();
    for (const rg of rgQuery.data) {
      rgMap.set(rg.id, rg);
    }

    return albums.map((album) => {
      const rg = rgMap.get(album.mbid) ?? rgMap.get(album.foreignAlbumId);
      return {
        ...album,
        albumType: (rg?.['primary-type'] ?? 'Album') as PrimaryReleaseType,
        secondaryTypes: (rg?.['secondary-types'] ?? []) as SecondaryReleaseType[],
      };
    });
  }, [albums, rgQuery.data]);

  return {
    albums: enriched,
    isLoadingTypes: rgQuery.isLoading,
  };
}
