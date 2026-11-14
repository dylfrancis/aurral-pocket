// Direct MusicBrainz lookups (not via the Aurral backend, which only searches
// by name). Used to disambiguate a Shazam match: an ISRC names the song's
// recording, whose artist MBIDs are the same identifiers Aurral/Lidarr uses as
// `foreignArtistId`, so the sheet can name the right artists even when a name
// search returns several same-named acts.
//
// MusicBrainz asks for a descriptive User-Agent and ~1 req/sec; Shazam matches
// are infrequent and results are cached by ISRC, so we stay well within that.
const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT =
  "AurralPocket/0.7 ( https://github.com/dylfrancis/aurral-pocket )";

export type IsrcRecording = {
  /** The recording's MBID. */
  mbid: string;
  title: string;
  /** Every artist the recording credits, in credit order. */
  artists: { mbid: string; name: string }[];
};

type IsrcResponse = {
  recordings?: {
    id?: string;
    title?: string;
    "artist-credit"?: { artist?: { id?: string; name?: string } }[];
  }[];
};

/**
 * MusicBrainz could not answer just now. It often replies 503 "server is
 * currently busy", so this is thrown for the query to retry, not read as an
 * unknown ISRC.
 */
export class MusicBrainzUnavailableError extends Error {
  constructor(readonly status: number) {
    super(`MusicBrainz answered ${status}`);
    this.name = "MusicBrainzUnavailableError";
  }
}

/**
 * Every recording MusicBrainz files under an ISRC, each with the artists it
 * credits. Empty when MusicBrainz doesn't know the ISRC. An ISRC can carry
 * recordings of other songs, so the caller picks the one that matches.
 * Throws when MusicBrainz is busy or unreachable.
 */
export async function lookupRecordingsByIsrc(
  isrc: string,
): Promise<IsrcRecording[]> {
  const url = `${MB_BASE}/isrc/${encodeURIComponent(isrc)}?inc=artist-credits&fmt=json`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  // 404 is an ISRC MusicBrainz has no recording for, 400 one it can't parse.
  if (response.status === 404 || response.status === 400) return [];
  if (!response.ok) throw new MusicBrainzUnavailableError(response.status);

  const data = (await response.json()) as IsrcResponse;
  const recordings: IsrcRecording[] = [];
  for (const recording of data.recordings ?? []) {
    if (!recording.id) continue;
    const artists: IsrcRecording["artists"] = [];
    for (const credit of recording["artist-credit"] ?? []) {
      const mbid = credit.artist?.id;
      const name = credit.artist?.name;
      if (!mbid || !name || artists.some((artist) => artist.mbid === mbid)) {
        continue;
      }
      artists.push({ mbid, name });
    }
    recordings.push({
      mbid: recording.id,
      title: recording.title ?? "",
      artists,
    });
  }
  return recordings;
}
