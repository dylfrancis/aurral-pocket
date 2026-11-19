export type ScrobbleProvider = "listenbrainz" | "koito";

export type ScrobbleConnection = {
  connected: boolean;
  /** The account name on that service, or the Koito host. */
  displayName: string | null;
  /** Epoch milliseconds. */
  connectedAt: number | null;
};

export type ScrobbleStatus = {
  listenbrainz: ScrobbleConnection;
  koito: ScrobbleConnection;
};
