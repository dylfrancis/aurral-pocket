import { useQuery } from "@tanstack/react-query";
import { readArtistSongs } from "@/hooks/library/use-play-library-songs";
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

/** A Library artist's songs to play, for an artist with no MBID. */
export function useArtistSongs(libraryArtistId: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.artistSongs(libraryArtistId ?? ""),
    queryFn: () => readArtistSongs(libraryArtistId!),
    enabled: !!libraryArtistId,
  });
}
