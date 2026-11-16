import { useCallback } from "react";
import { absolutizeServerPath } from "@/lib/api/client";
import {
  pause,
  pauseClip,
  playItem,
  resume,
  usePlayerStatus,
} from "@/lib/player/player";

/** What the notification shows while a clip plays. */
export type PreviewMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string | null;
};

/**
 * Play a thirty-second clip, or through `toggleItem` any sound a row starts.
 *
 * Clips run through the same engine as owned tracks, so a clip and a library
 * track can never sound at once: starting either one replaces the other. See
 * lib/player/player.ts. `stop` pauses only a clip.
 */
export function useAudioPreview() {
  const status = usePlayerStatus();

  const playingId = status.isPlaying ? status.currentId : null;
  // Rows show a spinner for this clip; a loading row that looks idle invites
  // a second tap.
  const loadingId = status.isBuffering ? status.currentId : null;

  /** Pause or resume `trackId` if the player holds it, else `start` it. */
  const toggleItem = useCallback(
    async (trackId: string, start: () => Promise<unknown>) => {
      if (status.currentId === trackId) {
        if (status.isPlaying) {
          await pause();
          return;
        }
        if (status.isPaused) {
          await resume();
          return;
        }
        // Loading: the play is already on its way. Finished: stopped at the
        // end, so fall through and start it over.
        if (status.isBuffering) return;
      }

      await start();
    },
    [status.currentId, status.isPlaying, status.isPaused, status.isBuffering],
  );

  const toggle = useCallback(
    (trackId: string, previewUrl: string, meta: PreviewMetadata = {}) =>
      toggleItem(trackId, () =>
        playItem({
          id: trackId,
          title: meta.title || "Preview",
          artist: meta.artist || "Unknown Artist",
          album: meta.album || "Unknown Album",
          duration: 0,
          // The server sends Deezer clips as paths. They need no token.
          url: absolutizeServerPath(previewUrl),
          artwork: meta.artwork ?? null,
        }),
      ),
    [toggleItem],
  );

  return {
    playingId,
    loadingId,
    progress: status.progress,
    toggle,
    toggleItem,
    stop: stopPreviewClip,
  };
}

export function stopPreviewClip() {
  void pauseClip();
}
