import type { PluginMenuItem } from "@/hooks/plugins/use-plugin-actions";

export type TrackMenuActionId =
  | "library"
  | "playlist"
  | "album"
  | "artist"
  | "download"
  | "retry"
  | "stop"
  | "remove"
  | "save-offline"
  | "remove-offline"
  | "saved-with"
  | "delete";

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
  /** Set off from the actions by a divider. */
  pluginActions?: PluginMenuItem[];
  /** Below the plugin actions, as Delete is in every ⋯ menu. */
  trailingActions?: TrackMenuAction[];
  triggerColor: string;
  /** A smaller glyph, for a track row. The target stays full size. */
  compact?: boolean;
  accessibilityLabel?: string;
};
