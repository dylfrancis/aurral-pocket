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
