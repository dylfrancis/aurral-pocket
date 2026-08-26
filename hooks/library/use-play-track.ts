import { useCallback } from "react";
import * as Burnt from "burnt";
import { playTrack } from "@/lib/player/player";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import type { Track } from "@/lib/types/library";

/**
 * Play a library track and say what happened when it does not play.
 *
 * Two failures look identical to a silent tap, so both get a message:
 *
 * - Aurral has no readable file for the track. Its row still shows a
 *   checkmark, because Lidarr has the file. See canonicalTrackToTrack.
 * - The engine rejected the track. A bad stream URL and an expired session
 *   both land here.
 */
export function usePlayTrack() {
  return useCallback(async (track: Track, album: PlayerAlbumContext) => {
    try {
      const started = await playTrack(track, album);
      if (started) return;
      Burnt.toast({
        title: "Cannot play this track",
        message:
          "Aurral has no file it can read for this track. Check that its music folder is mounted.",
        preset: "error",
      });
    } catch (error) {
      Burnt.toast({
        title: "Playback failed",
        message: error instanceof Error ? error.message : String(error),
        preset: "error",
      });
    }
  }, []);
}
