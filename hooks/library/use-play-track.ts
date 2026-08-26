import { useCallback } from "react";
import * as Burnt from "burnt";
import { playTrack } from "@/lib/player/player";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import type { Track } from "@/lib/types/library";

/**
 * Play a library track and say what happened when it does not play. Both
 * failures would otherwise look like a silent tap: Aurral has no readable
 * file (the row can still show a checkmark, because Lidarr has one), or the
 * engine rejected the track.
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
