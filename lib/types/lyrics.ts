/**
 * One line of lyrics. `start` is in milliseconds and is set only on synced
 * lyrics. A blank `value` is a gap between sung lines.
 */
export type LyricLine = { start?: number; value: string };

export type Lyrics = { synced: boolean; lines: LyricLine[] };

/** The query GET /lyrics takes. Every value goes on the wire as a string. */
export type LyricsLookup = {
  artist: string;
  title: string;
  album?: string;
  /** Sent with `libraryTrackId`, so Aurral can read the file's own lyrics. */
  libraryAlbumId?: string;
  libraryTrackId?: string;
};
