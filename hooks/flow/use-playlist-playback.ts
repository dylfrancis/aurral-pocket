import { useCallback } from "react";
import * as Burnt from "burnt";
import { playQueueFrom, setShuffle } from "@/lib/player/player";
import {
  collectionPlayerContext,
  jobToPlayerTrack,
  type PlaybackCollection,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type { FlowJob } from "@/lib/types/flow";

/** The queue's context is what keeps it playing when its page closes. */
export function usePlaylistPlayback(
  collection: PlaybackCollection,
  jobs: FlowJob[],
) {
  // The queue is built at the tap, not held in a memo: each URL carries the
  // session token, which can change while the page stays open.
  const start = useCallback(
    async (
      pickFirst: (items: PlayerTrack[]) => PlayerTrack | undefined,
      { shuffled = false } = {},
    ) => {
      const items = jobs
        .map((job) => jobToPlayerTrack(job, collection))
        .filter((item): item is PlayerTrack => item !== null);
      // Starting a track the queue doesn't hold would stop what's playing and
      // play nothing.
      const first = pickFirst(items);
      if (!first) {
        Burnt.toast({ title: "Cannot play this track", preset: "error" });
        return;
      }
      try {
        // Before the play, so the rebuilt queue comes out shuffled.
        if (shuffled) await setShuffle(true);
        await playQueueFrom(
          items,
          first.id,
          collectionPlayerContext(collection),
        );
      } catch (error) {
        Burnt.toast({
          title: "Playback failed",
          message: error instanceof Error ? error.message : String(error),
          preset: "error",
        });
      }
    },
    [jobs, collection],
  );

  const playFrom = useCallback(
    (jobId: string) => start((items) => items.find((i) => i.id === jobId)),
    [start],
  );
  const playAll = useCallback(() => start((items) => items[0]), [start]);
  const shuffle = useCallback(
    () =>
      start((items) => items[Math.floor(Math.random() * items.length)], {
        shuffled: true,
      }),
    [start],
  );

  return {
    canPlay: jobs.some((job) => job.status === "done"),
    playFrom,
    playAll,
    shuffle,
  };
}
