/**
 * The outside accounts Aurral reads a user's listening history from. A user
 * can read from several at once, and all null means local history only.
 */
export type ListenHistorySettings = {
  /** Last.fm username. */
  lastfm: string | null;
  /** ListenBrainz username. */
  listenbrainz: string | null;
  /** Koito base URL, normalized by the server. */
  koito: string | null;
};

export type ListenHistoryProvider = keyof ListenHistorySettings;

/** Only the providers to change. Null clears one. */
export type UpdateListenHistoryPayload = Partial<ListenHistorySettings>;

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

/** Every section in Aurral's Discover layout (`lib/discoverLayout.ts`). */
export type DiscoverLayoutSectionId =
  | "recentlyAdded"
  | "playlists"
  | "recommendedShows"
  | "recentReleases"
  | "news"
  | "recommended"
  | "globalTop"
  | "genreSections";

/** How the web draws a Shows or News row. */
export type DiscoverFeedStyle = "list" | "square" | "wide";

/** One section of the layout as Aurral stores it. */
export type DiscoverLayoutEntry = {
  id: DiscoverLayoutSectionId;
  enabled: boolean;
  /** Set only on `recommendedShows` and `news`. */
  style?: DiscoverFeedStyle;
};

/** The sections pocket shows and lets you reorder. */
export type DiscoverSectionId = Exclude<DiscoverLayoutSectionId, "news">;

export type DiscoverSection = {
  id: DiscoverSectionId;
  label: string;
  enabled: boolean;
};

export type DiscoverLayoutResponse = {
  /** Null until the user saves a layout. */
  layout: DiscoverLayoutEntry[] | null;
};
