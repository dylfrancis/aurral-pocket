import { useQuery } from "@tanstack/react-query";
import { getArtistQueue } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/** Pass no MBID for an artist outside the Library: Aurral has nothing to play. */
export function useArtistQueue(mbid: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.artistQueue(mbid ?? ""),
    queryFn: () => getArtistQueue(mbid!),
    enabled: !!mbid,
  });
}
