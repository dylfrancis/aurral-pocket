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

export type DiscoverSectionId =
  | "recentlyAdded"
  | "playlists"
  | "recommendedShows"
  | "recentReleases"
  | "recommended"
  | "globalTop"
  | "genreSections";

export type DiscoverSection = {
  id: DiscoverSectionId;
  label: string;
  enabled: boolean;
};

export type DiscoverLayoutResponse = {
  layout: DiscoverSection[];
};
