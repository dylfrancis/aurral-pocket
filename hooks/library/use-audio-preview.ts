import { useCallback } from "react";
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
 * Play a thirty-second clip.
 *
 * Clips run through the same engine as owned tracks, so a clip and a library
 * track can never sound at once: starting either one replaces the other. See
 * lib/player/player.ts.
 */
export function useAudioPreview() {
  const status = usePlayerStatus();

  const playingId = status.isPlaying ? status.currentId : null;
  // Rows show a spinner for this clip; a loading row that looks idle invites
  // a second tap.
  const loadingId = status.isBuffering ? status.currentId : null;

  // Screens fire this on blur; pauseClip spares unrelated album playback.
  const stop = useCallback(() => {
    void pauseClip();
  }, []);

  const toggle = useCallback(
    async (trackId: string, previewUrl: string, meta: PreviewMetadata = {}) => {
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
        // end, so fall through and start the clip over.
        if (status.isBuffering) return;
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
    [status.currentId, status.isPlaying, status.isPaused, status.isBuffering],
  );

  return { playingId, loadingId, progress: status.progress, toggle, stop };
}
