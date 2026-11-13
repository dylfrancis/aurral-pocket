export type TrackMenuActionId =
  | "playlist"
  | "album"
  | "artist"
  | "download"
  | "retry"
  | "stop"
  | "remove"
  | "save-offline"
  | "remove-offline"
  | "saved-with";

export type TrackMenuAction = {
  id: TrackMenuActionId;
  title: string;
  destructive?: boolean;
  /** Shown, but can't be picked. */
  disabled?: boolean;
};

export type TrackMenuProps = {
  /** Each platform file gives them their icons. */
  actions: TrackMenuAction[];
  onAction: (id: TrackMenuActionId) => void;
  triggerColor: string;
  /** A smaller glyph, for a track row. The target stays full size. */
  compact?: boolean;
  accessibilityLabel?: string;
};
