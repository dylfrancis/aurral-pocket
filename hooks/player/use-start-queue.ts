import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { fillQueueCovers } from "@/hooks/player/queue-covers";
import { toastNotSaved } from "@/hooks/offline/toast-not-saved";
import { isOffline } from "@/lib/offline/network";
import { canPlayNow } from "@/lib/offline/saved-library";
import { playQueueFrom, setShuffle } from "@/lib/player/player";
import type { PlayerAlbumContext, PlayerTrack } from "@/lib/player/track-item";

export type StartQueueOptions = {
  /** Turns shuffle on and starts from a random track. */
  shuffled?: boolean;
  /** The track to start from. Defaults to the first one that can play. */
  startId?: string;
};

/**
 * Play a list of tracks as the queue, and say what happened when nothing
 * plays. Resolves true once playback starts.
 */
export function useStartQueue() {
  const queryClient = useQueryClient();
  return useCallback(
    async (
      items: PlayerTrack[],
      context: PlayerAlbumContext,
      { shuffled = false, startId }: StartQueueOptions = {},
    ) => {
      // Offline, the queue holds only saved tracks, so the pick comes from
      // those.
      const playable = items.filter((item) => canPlayNow(item.id));
      const first = startId
        ? playable.find((item) => item.id === startId)
        : shuffled
          ? playable[Math.floor(Math.random() * playable.length)]
          : playable[0];
      if (!first) {
        if (isOffline()) toastNotSaved();
        else Burnt.toast({ title: "Nothing to play", preset: "error" });
        return false;
      }
      try {
        // Before the play, so the rebuilt queue comes out shuffled.
        if (shuffled) await setShuffle(true);
        const started = await playQueueFrom(items, first.id, context);
        if (!started) {
          toastNotSaved();
          return false;
        }
        // The track that's starting goes first: its cover is the one on
        // screen.
        void fillQueueCovers(queryClient, [first, ...items]);
        return true;
      } catch (error) {
        Burnt.toast({
          title: "Playback failed",
          message: error instanceof Error ? error.message : String(error),
          preset: "error",
        });
        return false;
      }
    },
    [queryClient],
  );
}
