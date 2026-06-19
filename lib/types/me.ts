export type ListenHistoryProvider = "lastfm" | "listenbrainz" | "koito";

export type ListenHistorySettings = {
  listenHistoryProvider: ListenHistoryProvider | null;
  listenHistoryUsername: string | null;
  lastfmUsername: string | null;
  listenHistoryUrl: string | null;
};

export type UpdateListenHistoryPayload = {
  listenHistoryProvider: ListenHistoryProvider;
  listenHistoryUsername: string | null;
};

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
