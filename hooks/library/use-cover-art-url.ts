import { useQuery } from "@tanstack/react-query";
import { absolutizeImageUrl } from "@/lib/api/client";
import { getArtistCover, getAlbumCover } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { CoverArtType } from "@/lib/types/library";

type CoverArtOptions = {
  type: CoverArtType;
  mbid: string | undefined;
};

export function useCoverArtUrl({ type, mbid }: CoverArtOptions) {
  const query = useQuery({
    queryKey:
      type === "artist"
        ? libraryKeys.artistCover(mbid!)
        : libraryKeys.albumCover(mbid!),
    queryFn: () =>
      type === "artist" ? getArtistCover(mbid!) : getAlbumCover(mbid!),
    enabled: !!mbid,
    staleTime: (query) => (query.state.error ? 0 : Infinity),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  const images = query.data?.images;
  const raw =
    images?.find((img) => img.front)?.image ?? images?.[0]?.image ?? null;
  const url = absolutizeImageUrl(raw);

  return { url, isLoading: query.isLoading };
}
