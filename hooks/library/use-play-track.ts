import { useCallback } from "react";
import * as Burnt from "burnt";
import { toastNotSaved } from "@/hooks/offline/toast-not-saved";
import { isOffline } from "@/lib/offline/network";
import { playAlbumFromTrack } from "@/lib/player/player";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import type { Track } from "@/lib/types/library";

/**
 * Start Library playback, and say what happened when it does not play. Both
 * failures would otherwise look like a silent tap: Aurral has no readable
 * file, or the engine rejected the track. `play` resolves false when the
 * tapped track can't play now.
 */
export async function playOrExplain(play: () => Promise<boolean>) {
  try {
    if (await play()) return;
    if (isOffline()) {
      toastNotSaved();
      return;
    }
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
}

/** Play a library track, queueing the rest of its album behind it. */
export function usePlayTrack() {
  return useCallback(
    (tracks: Track[], track: Track, album: PlayerAlbumContext) =>
      playOrExplain(() => playAlbumFromTrack(tracks, track, album)),
    [],
  );
}
