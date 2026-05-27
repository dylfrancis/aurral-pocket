import type { IsrcArtist } from "@/lib/api/musicbrainz";
import type { SearchArtist } from "@/lib/types/search";

/**
 * Pick the artist candidates shown for a Shazam match. When an ISRC resolved to
 * an authoritative artist, that is the only candidate (the exact act, even if
 * name search ranked it low or never surfaced it — in which case a row is
 * synthesised from the MusicBrainz data so it can still be added by MBID).
 * Otherwise fall back to the top `limit` name-search results.
 */
export function rankCandidates(
  searchResults: SearchArtist[],
  isrcArtist: IsrcArtist | null,
  limit: number,
): { candidates: SearchArtist[]; hasBestMatch: boolean } {
  if (!isrcArtist) {
    return { candidates: searchResults.slice(0, limit), hasBestMatch: false };
  }

  const matched = searchResults.find((a) => a.id === isrcArtist.mbid);
  const best: SearchArtist = matched ?? {
    id: isrcArtist.mbid,
    name: isrcArtist.name,
    "sort-name": isrcArtist.name,
    image: null,
    imageUrl: null,
    listeners: null,
  };

  return { candidates: [best], hasBestMatch: true };
}
