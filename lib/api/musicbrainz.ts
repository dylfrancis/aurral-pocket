// Direct MusicBrainz lookups (not via the Aurral backend, which only searches
// by name). Used to disambiguate a Shazam match: an ISRC maps to an exact
// recording, whose artist MBID is the same identifier Aurral/Lidarr uses as
// `foreignArtistId` — letting us pin the right artist even when a name search
// returns several same-named acts.
//
// MusicBrainz asks for a descriptive User-Agent and ~1 req/sec; Shazam matches
// are infrequent and results are cached by ISRC, so we stay well within that.
const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT =
  "AurralPocket/0.7 ( https://github.com/dylfrancis/aurral-pocket )";

export type IsrcArtist = {
  mbid: string;
  name: string;
};

type IsrcResponse = {
  recordings?: {
    "artist-credit"?: { artist?: { id?: string; name?: string } }[];
  }[];
};

/**
 * Resolve the primary artist (MBID + name) for a recording by its ISRC, or
 * `null` when the ISRC is unknown or the request fails.
 */
export async function lookupArtistByIsrc(
  isrc: string,
): Promise<IsrcArtist | null> {
  const url = `${MB_BASE}/isrc/${encodeURIComponent(isrc)}?inc=artist-credits&fmt=json`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as IsrcResponse;
  const artist = data.recordings?.[0]?.["artist-credit"]?.[0]?.artist;
  if (!artist?.id || !artist.name) return null;

  return { mbid: artist.id, name: artist.name };
}
