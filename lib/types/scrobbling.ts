export type ScrobbleProvider = "lastfm" | "listenbrainz" | "koito";

export type ScrobbleConnection = {
  connected: boolean;
  /** The account name on that service, or the Koito host. */
  displayName: string | null;
  /** Epoch milliseconds. */
  connectedAt: number | null;
};

export type ScrobbleStatus = {
  /** `configured` is false until an admin adds a Last.fm API key and secret. */
  lastfm: ScrobbleConnection & { configured: boolean };
  listenbrainz: ScrobbleConnection;
  koito: ScrobbleConnection;
};
