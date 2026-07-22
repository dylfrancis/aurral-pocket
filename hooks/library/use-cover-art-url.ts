import { absolutizeImageUrl } from "@/lib/api/client";
import { getAlbumCover, getArtistCover } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { CoverArtType } from "@/lib/types/library";
import { useQuery } from "@tanstack/react-query";

type CoverArtOptions = {
  type: CoverArtType;
  mbid: string | undefined;
  providedUrl?: string | null;
};

export function useCoverArtUrl({ type, mbid, providedUrl }: CoverArtOptions) {
  const hasProvidedUrl = !!providedUrl;
  const query = useQuery({
    queryKey:
      type === "artist"
        ? libraryKeys.artistCover(mbid!)
        : libraryKeys.albumCover(mbid!),
    queryFn: () =>
      type === "artist" ? getArtistCover(mbid!) : getAlbumCover(mbid!),
    enabled: !!mbid && !hasProvidedUrl,
    staleTime: (query) => (query.state.error ? 0 : Infinity),
    // Backend negative-caches missing covers, so a miss is cheap to re-hit.
    // One retry is plenty; 3 meant 3 failed round-trips per empty card.
    retry: 1,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  if (hasProvidedUrl) {
    return { url: absolutizeImageUrl(providedUrl), isLoading: false };
  }

  const images = query.data?.images;
  const raw =
    images?.find((img) => img.front)?.image ?? images?.[0]?.image ?? null;
  const url = absolutizeImageUrl(raw);

  return { url, isLoading: query.isLoading };
}
