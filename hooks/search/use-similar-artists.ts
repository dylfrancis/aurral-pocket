import { useQuery } from "@tanstack/react-query";
import { getSimilarArtists } from "@/lib/api/search";
import { searchKeys } from "@/lib/query-keys";

export function useSimilarArtists(mbid: string | undefined) {
  return useQuery({
    queryKey: searchKeys.similarArtists(mbid!),
    queryFn: () => getSimilarArtists(mbid!),
    enabled: !!mbid,
    staleTime: 30 * 60 * 1000,
  });
}
