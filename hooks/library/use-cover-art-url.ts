import { useQuery } from "@tanstack/react-query";
import { absolutizeImageUrl } from "@/lib/api/client";
import {
  getArtistCover,
  getAlbumCover,
  type AlbumCoverHints,
} from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { CoverArtResponse, CoverArtType } from "@/lib/types/library";

type CoverArtOptions = {
  type: CoverArtType;
  mbid: string | undefined;
  hints?: AlbumCoverHints;
};

export function coverArtUrlFrom(cover: CoverArtResponse | undefined) {
  const images = cover?.images;
  const raw =
    images?.find((img) => img.front)?.image ?? images?.[0]?.image ?? null;
  return absolutizeImageUrl(raw);
}

const COVER_QUERY_OPTIONS = {
  staleTime: (query: { state: { error: unknown } }) =>
    query.state.error ? 0 : Infinity,
  retry: 3,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
};

export function albumCoverQuery(mbid: string, hints?: AlbumCoverHints) {
  return {
    queryKey: libraryKeys.albumCover(mbid),
    queryFn: () => getAlbumCover(mbid, hints),
    ...COVER_QUERY_OPTIONS,
  };
}

export function useCoverArtUrl({ type, mbid, hints }: CoverArtOptions) {
  const query = useQuery<CoverArtResponse>({
    ...(type === "artist"
      ? {
          queryKey: libraryKeys.artistCover(mbid!),
          queryFn: () => getArtistCover(mbid!),
          ...COVER_QUERY_OPTIONS,
        }
      : albumCoverQuery(mbid!, hints)),
    enabled: !!mbid,
  });

  return { url: coverArtUrlFrom(query.data), isLoading: query.isLoading };
}
