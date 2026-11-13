import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { toastNotSaved } from "@/hooks/offline/toast-not-saved";
import { isOffline } from "@/lib/offline/network";
import { canPlayNow } from "@/lib/offline/saved-library";
import { cachedAlbumCover, fillQueueCovers } from "@/hooks/player/queue-covers";
import { playQueueFrom, setShuffle } from "@/lib/player/player";
import {
  collectionPlayerContext,
  isPlayableJob,
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
  const queryClient = useQueryClient();

  // The queue is built at the tap, not held in a memo: each URL carries the
  // session token, which can change while the page stays open.
  const start = useCallback(
    async (
      pickFirst: (items: PlayerTrack[]) => PlayerTrack | undefined,
      { shuffled = false } = {},
    ) => {
      const items = jobs
        .map((job) =>
          jobToPlayerTrack(
            job,
            collection,
            cachedAlbumCover(queryClient, job.albumMbid),
          ),
        )
        .filter((item): item is PlayerTrack => item !== null);
      // Starting a track the queue doesn't hold would drop the old queue and
      // then fail. Offline, the queue holds only saved tracks, so the pick
      // comes from those.
      const first = pickFirst(items.filter((item) => canPlayNow(item.id)));
      if (!first) {
        if (isOffline()) toastNotSaved();
        else Burnt.toast({ title: "Cannot play this track", preset: "error" });
        return;
      }
      try {
        // Before the play, so the rebuilt queue comes out shuffled.
        if (shuffled) await setShuffle(true);
        const started = await playQueueFrom(
          items,
          first.id,
          collectionPlayerContext(collection),
        );
        if (!started) {
          toastNotSaved();
          return;
        }
        // The track that's starting goes first: its cover is the one on screen.
        void fillQueueCovers(queryClient, [first, ...items]);
      } catch (error) {
        Burnt.toast({
          title: "Playback failed",
          message: error instanceof Error ? error.message : String(error),
          preset: "error",
        });
      }
    },
    [jobs, collection, queryClient],
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
    canPlay: jobs.some(isPlayableJob),
    playFrom,
    playAll,
    shuffle,
  };
}
