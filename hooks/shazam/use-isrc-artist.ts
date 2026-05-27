import { useQuery } from "@tanstack/react-query";
import { lookupArtistByIsrc } from "@/lib/api/musicbrainz";

/**
 * Resolve a Shazam match's ISRC to its authoritative MusicBrainz artist.
 * Results are immutable per ISRC, so cache them indefinitely.
 */
export function useIsrcArtist(isrc: string | null) {
  return useQuery({
    queryKey: ["shazam", "isrc", isrc],
    queryFn: () => lookupArtistByIsrc(isrc!),
    enabled: !!isrc,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
