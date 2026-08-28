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
  /** Track length in milliseconds. Null when the engine never reported one. */
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
