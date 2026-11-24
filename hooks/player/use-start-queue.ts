import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { fillQueueCovers } from "@/hooks/player/queue-covers";
import { toastNotSaved } from "@/hooks/offline/toast-not-saved";
import { isOffline } from "@/lib/offline/network";
import { canPlayNow } from "@/lib/offline/saved-library";
import { playQueueFrom } from "@/lib/player/player";
import type { PlayerAlbumContext, PlayerTrack } from "@/lib/player/track-item";

export type StartQueueOptions = {
  /**
   * True turns shuffle on and starts from a random track; false turns it off,
   * as a Play button does. Left out, shuffle stays as it is, for a tapped song.
   */
  shuffled?: boolean;
  /** The track to start from. Defaults to the first one that can play. */
  startId?: string;
};

/** "notStarted": the player refused the start, which offline means the track isn't saved. */
export type StartQueueResult = "started" | "nothingPlayable" | "notStarted";

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
      options: StartQueueOptions = {},
    ) => {
      try {
        const result = await startQueue(queryClient, items, context, options);
        if (result === "nothingPlayable") {
          if (isOffline()) toastNotSaved();
          else Burnt.toast({ title: "Nothing to play", preset: "error" });
        } else if (result === "notStarted") {
          toastNotSaved();
        }
        return result === "started";
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

/** useStartQueue without the feedback, for callers with no screen. */
export async function startQueue(
  queryClient: QueryClient,
  items: PlayerTrack[],
  context: PlayerAlbumContext,
  { shuffled, startId }: StartQueueOptions = {},
): Promise<StartQueueResult> {
  // Offline, the queue holds only saved tracks, so the pick comes from
  // those.
  const playable = items.filter((item) => canPlayNow(item.id));
  const first = startId
    ? playable.find((item) => item.id === startId)
    : shuffled
      ? playable[Math.floor(Math.random() * playable.length)]
      : playable[0];
  if (!first) return "nothingPlayable";

  const started = await playQueueFrom(items, first.id, context, {
    shuffle: shuffled,
  });
  if (!started) return "notStarted";
  // The track that's starting goes first: its cover is the one on
  // screen.
  void fillQueueCovers(queryClient, [first, ...items]);
  return "started";
}
