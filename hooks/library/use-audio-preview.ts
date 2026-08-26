import { useCallback } from "react";
import { pause, playItem, resume, usePlayerStatus } from "@/lib/player/player";

/** What the notification shows while a clip plays. */
export type PreviewMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string | null;
};

/**
 * Play a thirty-second clip.
 *
 * Clips run through the same engine as owned tracks, so a clip and a library
 * track can never sound at once: starting either one replaces the other. See
 * lib/player/player.ts.
 */
export function useAudioPreview() {
  const status = usePlayerStatus();

  const playingId = status.isPlaying ? status.currentId : null;
  // A clip takes time to download. Without this the row looks idle while it
  // loads, and the reflex is to tap again.
  const loadingId = status.isBuffering ? status.currentId : null;

  const stop = useCallback(() => {
    void pause();
  }, []);

  const toggle = useCallback(
    async (trackId: string, previewUrl: string, meta: PreviewMetadata = {}) => {
      if (status.currentId === trackId) {
        await (status.isPlaying ? pause() : resume());
        return;
      }

      await playItem({
        id: trackId,
        title: meta.title || "Preview",
        artist: meta.artist || "Unknown Artist",
        album: meta.album || "Unknown Album",
        duration: 0,
        url: previewUrl,
        artwork: meta.artwork ?? null,
      });
    },
    [status.currentId, status.isPlaying],
  );

  return { playingId, loadingId, progress: status.progress, toggle, stop };
}
