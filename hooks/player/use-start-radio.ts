import { useCallback } from "react";
import * as Burnt from "burnt";
import { startRadio } from "@/lib/player/player";
import type { RadioStation } from "@/lib/player/radio";
import type { PlayerTrack } from "@/lib/player/track-item";

/**
 * Start a station, saying so when it can't. Android shows a toast's title
 * alone, so each title carries the reason.
 */
export function useStartRadio() {
  return useCallback(
    async (station: RadioStation, first: PlayerTrack | null = null) => {
      try {
        const result = await startRadio(station, first);
        if (result === "offline") {
          Burnt.toast({ title: "Radio needs a connection", preset: "error" });
        } else if (result === "empty") {
          Burnt.toast({
            title: "No similar music in your Library",
            preset: "error",
          });
        }
      } catch {
        Burnt.toast({ title: "Couldn't start radio", preset: "error" });
      }
    },
    [],
  );
}
