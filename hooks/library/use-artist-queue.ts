import { useQuery } from "@tanstack/react-query";
import { getArtistQueue } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/**
 * A Library artist's tracks, in album order. Pass no MBID for an artist
 * outside the Library: Aurral has nothing to play for them.
 */
export function useArtistQueue(mbid: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.artistQueue(mbid ?? ""),
    queryFn: () => getArtistQueue(mbid!),
    enabled: !!mbid,
  });
}
