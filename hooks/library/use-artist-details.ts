import { useQuery } from "@tanstack/react-query";
import { getArtistDetails } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/** An artist's tags, bio and release groups. */
export function useArtistDetails(mbid: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.artistDetails(mbid!),
    queryFn: ({ signal }) => getArtistDetails(mbid!, signal),
    enabled: !!mbid,
    staleTime: 30 * 60 * 1000,
  });
}
