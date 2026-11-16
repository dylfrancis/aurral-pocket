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

export type LiveMessageType<C extends LiveChannel> =
  LiveChannelMessages[C]["type"];

export type LiveMessage<
  C extends LiveChannel,
  T extends LiveMessageType<C> = LiveMessageType<C>,
> = Extract<LiveChannelMessages[C], { type: T }> & {
  channel: C;
  /** When the server sent it, in epoch ms. */
  timestamp: number;
};
