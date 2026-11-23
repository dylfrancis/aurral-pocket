import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";
import { useIsForeground } from "@/hooks/use-is-foreground";
import { usePlaybackSettings } from "@/lib/player/playback-settings";

const TAG = "lyrics";

/**
 * Keeps the screen on while lyrics show and a song plays, unless Settings
 * turned that off. Closing them, pausing or leaving the app gives the screen
 * back to the phone's usual timeout.
 *
 * The hold is let go in the background and taken again on return. Android
 * keeps it on the activity's window and remembers it by tag, so a hold kept
 * through a new activity, or let go once that window is gone, never reaches
 * the new window.
 */
export function useLyricsKeepAwake(lyricsShown: boolean, playing: boolean) {
  const { keepScreenOnWithLyrics } = usePlaybackSettings();
  const foreground = useIsForeground();
  const awake = lyricsShown && playing && keepScreenOnWithLyrics && foreground;

  useEffect(() => {
    if (!awake) return;
    // A refusal leaves the phone's usual timeout, which is all this changes.
    activateKeepAwakeAsync(TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(TAG).catch(() => {});
    };
  }, [awake]);
}
