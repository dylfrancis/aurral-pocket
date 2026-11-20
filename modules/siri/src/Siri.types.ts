/** Siri's media types, as the native module names them. */
export type SiriMediaType =
  | "song"
  | "album"
  | "artist"
  | "genre"
  | "playlist"
  | "music"
  | "station"
  | "unknown"
  | "other";

/**
 * The kinds of item the app answers with. "music" is a whole-library play,
 * and "station" a radio station.
 */
export type SiriItemType =
  "song" | "album" | "artist" | "genre" | "playlist" | "music" | "station";

/** One of Siri's own catalog guesses for what was asked. */
export type SiriSuggestion = {
  type: SiriMediaType;
  title?: string;
  artist?: string;
};

/** What Siri heard. Any field can be missing; often only `name` is set. */
export type SiriSearch = {
  mediaType: SiriMediaType;
  name?: string;
  artist?: string;
  album?: string;
  genres: string[];
  /** "my …", as in "play my workout playlist". */
  mine: boolean;
  suggested: SiriSuggestion[];
  shuffle?: boolean;
};

export type SiriFindRequest = SiriSearch & { id: string; type: "find" };

export type SiriPlayRequest = {
  id: string;
  type: "play";
  itemId: string;
  /** What the item is called, to find it again when its id is from an earlier run. */
  title?: string;
  artist?: string;
  itemType?: SiriMediaType;
  shuffle?: boolean;
};

export type SiriRequest = SiriFindRequest | SiriPlayRequest;

export type SiriItem = {
  id: string;
  title: string | null;
  type: SiriItemType;
  artist?: string | null;
};

export type SiriFindAnswer =
  | { status: "found"; item: SiriItem }
  | { status: "notFound" }
  | { status: "signedOut" }
  | { status: "unavailable" }
  | { status: "unsupportedType" };

export type SiriPlayAnswer = { status: "playing" } | { status: "failed" };

export type SiriModuleEvents = {
  onRequest: (request: SiriRequest) => void;
};
