/**
 * A song identified by ShazamKit. All fields beyond `title` are best-effort —
 * ShazamKit's media item does not guarantee them, and `album` in particular is
 * frequently absent, so resolution against the library is driven off `artist`.
 */
export type ShazamMatch = {
  title: string;
  artist: string | null;
  album: string | null;
  artworkUrl: string | null;
  appleMusicUrl: string | null;
  isrc: string | null;
  shazamId: string | null;
};

/** Why a listening session ended without a match. */
export type ShazamErrorCode =
  | "permission" // microphone permission was denied
  | "unavailable" // ShazamKit / mic could not be initialised
  | "token" // Android developer token missing or rejected
  | "error"; // generic failure (network, audio engine, etc.)

export type ShazamError = {
  code: ShazamErrorCode;
  message: string;
};

export type ShazamModuleEvents = {
  onMatch: (event: { match: ShazamMatch }) => void;
  onNoMatch: () => void;
  onError: (event: ShazamError) => void;
};
