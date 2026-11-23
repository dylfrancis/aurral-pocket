/**
 * A play the app reports to Aurral. The server stores it as local history and
 * forwards it to whichever scrobble providers the user linked on the web app.
 * Pocket links nothing; it only reports.
 */
export type PlayEventInput = {
  trackId: string;
  title: string;
  artist: string;
  album: string | null;
  artistMbid: string | null;
  albumMbid: string | null;
  trackMbid: string | null;
  /** Track length in milliseconds. Null only on a play an older version saved. */
  durationMs: number | null;
  /** Milliseconds since the epoch. The server reads values this large as ms. */
  playedAt: number;
  /** Which client played it. The server stores the string as given. */
  source: string;
};

export type PlayEvent = PlayEventInput & {
  id: number;
  userId: number;
};

/**
 * The track the listener has just started, for the scrobble services' live
 * "now playing". The server keeps no history of it.
 */
export type NowPlayingInput = Omit<
  PlayEventInput,
  "durationMs" | "playedAt" | "source"
> & {
  /** Track length in milliseconds. Null while the engine has not read it. */
  durationMs: number | null;
  /** Lets the server name the Library file or playlist job behind the track. */
  streamPath: string;
};
