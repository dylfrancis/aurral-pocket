export type TrackMenuActionId = "playlist" | "album" | "artist";

export type TrackMenuAction = {
  id: TrackMenuActionId;
  title: string;
};

export type TrackMenuProps = {
  /** Each platform file gives them their icons. */
  actions: TrackMenuAction[];
  onAction: (id: TrackMenuActionId) => void;
  triggerColor: string;
};
