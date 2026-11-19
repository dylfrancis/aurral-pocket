import type { FlowStatusSnapshot } from "@/lib/types/flow";

/** The messages each of Aurral's socket channels carries, by channel. */
export type LiveChannelMessages = {
  library:
    { type: "library_scan_completed" } | { type: "release_metadata_refreshed" };
  playlists: { type: "playlist_status"; status: FlowStatusSnapshot };
  discovery: {
    type: "discovery_update";
    isUpdating: boolean;
    configured?: boolean;
    phase?: string | null;
    progress?: number;
    progressMessage?: string;
    error?: string;
    reason?: string;
    provider?: string | null;
    lastUpdated?: string | null;
  };
  plugins: { type: "plugin_action_finished"; ok: boolean; message: string };
  "play-queue": {
    type: "play_queue_changed";
    /** When the queue was saved, in epoch ms. */
    changed: number;
    changedBy: string;
  };
};

export type LiveChannel = keyof LiveChannelMessages;

/**
 * The only types pocket can listen for. The contract check probes the socket
 * with this list.
 */
export const LIVE_MESSAGE_TYPES = {
  library: ["library_scan_completed", "release_metadata_refreshed"],
  playlists: ["playlist_status"],
  discovery: ["discovery_update"],
  plugins: ["plugin_action_finished"],
  "play-queue": ["play_queue_changed"],
} as const satisfies {
  [C in LiveChannel]: readonly LiveChannelMessages[C]["type"][];
};

export type LiveMessageType<C extends LiveChannel> =
  (typeof LIVE_MESSAGE_TYPES)[C][number];

export type LiveMessage<
  C extends LiveChannel,
  T extends LiveMessageType<C> = LiveMessageType<C>,
> = Extract<LiveChannelMessages[C], { type: T }> & {
  channel: C;
  /** When the server sent it, in epoch ms. */
  timestamp: number;
};
