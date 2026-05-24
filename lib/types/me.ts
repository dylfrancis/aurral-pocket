export type ListenHistoryProvider = "lastfm" | "listenbrainz";

export type ListenHistorySettings = {
  listenHistoryProvider: ListenHistoryProvider | null;
  listenHistoryUsername: string | null;
  lastfmUsername: string | null;
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
  | "recommendedShows"
  | "recentReleases"
  | "recommended"
  | "globalTop"
  | "genreSections"
  | "topTags";

export type DiscoverSection = {
  id: DiscoverSectionId;
  label: string;
  enabled: boolean;
};

export type DiscoverLayoutResponse = {
  layout: DiscoverSection[];
};
