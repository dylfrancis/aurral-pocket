import { useQuery } from '@tanstack/react-query';
import { getArtistCover, getAlbumCover } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';
import type { CoverArtType } from '@/lib/types/library';

type CoverArtOptions = {
  type: CoverArtType;
  mbid: string | undefined;
};

export function useCoverArtUrl({ type, mbid }: CoverArtOptions) {
  const query = useQuery({
    queryKey:
      type === 'artist'
        ? libraryKeys.artistCover(mbid!)
        : libraryKeys.albumCover(mbid!),
    queryFn: () =>
      type === 'artist' ? getArtistCover(mbid!) : getAlbumCover(mbid!),
    enabled: !!mbid,
    staleTime: Infinity,
  });

  const images = query.data?.images;
  const raw = images?.find((img) => img.front)?.image ?? images?.[0]?.image ?? null;
  const url = raw?.replace(/^http:\/\//, 'https://') ?? null;

  return { url, isLoading: query.isLoading };
}
