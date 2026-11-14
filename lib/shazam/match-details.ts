import type { IsrcRecording } from "@/lib/api/musicbrainz";
import {
  creditedNames,
  normalizeForMatch,
  stripFeaturedCredits,
} from "@/lib/shazam/credits";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import type { SharedPlaylistTrack } from "@/lib/types/flow";
import type { Track } from "@/lib/types/library";
import type {
  LibrarySearchTrack,
  SearchArtist,
  StreamingLink,
} from "@/lib/types/search";
import type { ShazamMatch } from "@/modules/shazam";

/** What the two lookups said about a match. Null when one missed or failed. */
export type MatchLookups = {
  recording: IsrcRecording | null;
  link: StreamingLink | null;
};

/**
 * The recording under the match's ISRC that is the matched song. MusicBrainz
 * can file one ISRC under recordings of other songs: Universal's 2013 ISRCs
 * also carry chapters of a Jane Austen audiobook. So a recording counts only
 * when it shares an artist or the title with the match, and a shared artist
 * counts for more, since a reissue can retitle a song. Null when none does.
 */
export function pickRecording(
  recordings: readonly IsrcRecording[],
  match: ShazamMatch,
): IsrcRecording | null {
  const title = normalizeForMatch(match.title);
  const names = new Set(
    creditedNames(match.artist ?? "")
      .map(normalizeForMatch)
      .filter(Boolean),
  );
  let best: IsrcRecording | null = null;
  let bestScore = 0;
  for (const recording of recordings) {
    const sharesArtist = recording.artists.some((artist) =>
      names.has(normalizeForMatch(artist.name)),
    );
    const sharesTitle = normalizeForMatch(recording.title) === title;
    const score = (sharesArtist ? 2 : 0) + (sharesTitle ? 1 : 0);
    if (score > bestScore) {
      best = recording;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The artists the match names by MBID: every artist the ISRC's recording
 * credits, else the artist of the match's Apple Music link. Null when neither
 * names one, and the sheet falls back to a name search.
 */
export function identifiedArtists({
  recording,
  link,
}: MatchLookups): SearchArtist[] | null {
  if (recording && recording.artists.length > 0) {
    return recording.artists.map(({ mbid, name }) => ({ id: mbid, name }));
  }
  if (link?.artist.mbid && link.artist.name) {
    return [{ id: link.artist.mbid, name: link.artist.name }];
  }
  return null;
}

/** The name-search query when no lookup names an artist: the main artist. */
export function artistSearchQuery(match: ShazamMatch): string {
  return stripFeaturedCredits(match.artist ?? "");
}

/** The library-search query. The server finds nothing for "artist title". */
export function librarySearchQuery(match: ShazamMatch): string {
  return stripFeaturedCredits(match.title);
}

/**
 * The library track that is the matched song. The recording MBID decides when
 * a lookup gave one. Otherwise the title has to match, and so does the artist,
 * by MBID or by any name the credit could stand for: a library album credited
 * to "Sam Smith" holds the song Shazam credits to "Sam Smith & Kim Petras".
 */
export function findLibraryTrack(
  tracks: readonly LibrarySearchTrack[],
  match: ShazamMatch,
  { recording, link }: MatchLookups,
): LibrarySearchTrack | null {
  const playable = tracks.filter((track) => track.streamPath);

  const recordingMbids = new Set(
    [recording?.mbid, link?.track?.mbid].filter(Boolean),
  );
  const byRecording = playable.find(
    (track) => track.trackMbid && recordingMbids.has(track.trackMbid),
  );
  if (byRecording) return byRecording;

  const title = normalizeForMatch(match.title);
  const artistMbids = new Set(
    [
      ...(recording?.artists.map((artist) => artist.mbid) ?? []),
      link?.artist.mbid,
    ].filter(Boolean),
  );
  const artistNames = new Set(
    [
      ...creditedNames(match.artist ?? ""),
      ...(recording?.artists.map((artist) => artist.name) ?? []),
      link?.artist.name ?? "",
    ]
      .map(normalizeForMatch)
      .filter(Boolean),
  );
  return (
    playable.find(
      (track) =>
        normalizeForMatch(track.title) === title &&
        ((!!track.artistMbid && artistMbids.has(track.artistMbid)) ||
          artistNames.has(normalizeForMatch(track.artistName))),
    ) ?? null
  );
}

/**
 * The playlist entry for a song the library doesn't have. Adding it queues
 * the song's download. Null without an artist name, which the server needs.
 */
export function matchPlaylistTrack(
  match: ShazamMatch,
  { recording, link }: MatchLookups,
): SharedPlaylistTrack | null {
  const artistName =
    match.artist || link?.artist.name || recording?.artists[0]?.name;
  if (!artistName) return null;
  return {
    artistName,
    trackName: match.title,
    albumName: link?.album?.title ?? match.album ?? null,
    artistMbid: recording?.artists[0]?.mbid ?? link?.artist.mbid ?? null,
    albumMbid: link?.album?.mbid ?? null,
    trackMbid: recording?.mbid ?? link?.track?.mbid ?? null,
  };
}

/**
 * The library song as a track the player and the track actions take. It
 * plays alone, so it needs no position on its album. The search result has
 * no favourites key, so the actions sheet offers no favourite.
 */
export function librarySongTrack(song: LibrarySearchTrack): Track {
  return {
    id: song.id,
    mbid: song.trackMbid ?? "",
    trackName: song.title,
    title: song.title,
    trackNumber: 0,
    hasFile: true,
    size: 0,
    quality: null,
    streamPath: song.streamPath,
    available: true,
    artistName: song.artistName,
  };
}

/**
 * The album the library song plays from. Shazam's artwork stands in for the
 * cover, which the search result doesn't carry.
 */
export function librarySongAlbum(
  song: LibrarySearchTrack,
  artworkUrl: string | null,
): PlayerAlbumContext {
  return {
    albumTitle: song.albumTitle ?? "",
    artistName: song.artistName,
    coverPath: null,
    artworkUrl,
    albumMbid: song.albumMbid,
    artistMbid: song.artistMbid,
    albumRef: song.albumCanonicalId,
  };
}

export type MatchAlbum = {
  /** Release-group MBID. */
  mbid: string;
  title: string;
  artistName: string;
  artistMbid: string | null;
  /** True when the library holds the song on this album. */
  inLibrary: boolean;
  /** Known only when the library holds the song on this album. */
  year: string | null;
};

/**
 * The song's album, from its Apple Music link: Shazam sends no album, and the
 * ISRC names a recording, not an album. Null when the link names no
 * release-group MBID, as for most collaborations.
 */
export function matchAlbum(
  match: ShazamMatch,
  { recording, link }: MatchLookups,
  libraryTrack: LibrarySearchTrack | null,
): MatchAlbum | null {
  const mbid = link?.album?.mbid;
  if (!link?.album || !mbid) return null;
  const inLibrary = libraryTrack?.albumMbid === mbid;
  return {
    mbid,
    title: link.album.title,
    artistName: link.artist.name || match.artist || "",
    artistMbid: link.artist.mbid ?? recording?.artists[0]?.mbid ?? null,
    inLibrary,
    year: inLibrary ? libraryTrack.releaseYear : null,
  };
}
