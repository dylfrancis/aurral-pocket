import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import {
  albumCoverQuery,
  coverArtUrlFrom,
} from "@/hooks/library/use-cover-art-url";
import type { AlbumCoverHints } from "@/lib/api/library";
import {
  playQueueFrom,
  setQueuedAlbumCovers,
  setShuffle,
} from "@/lib/player/player";
import {
  collectionPlayerContext,
  jobToPlayerTrack,
  type PlaybackCollection,
  type PlayerTrack,
} from "@/lib/player/track-item";
import { libraryKeys } from "@/lib/query-keys";
import type { FlowJob } from "@/lib/types/flow";
import type { CoverArtResponse } from "@/lib/types/library";

/** Every track in a big flow can be from a different album. */
const COVER_LOOKUPS_AT_ONCE = 6;

function loadedAlbumCover(queryClient: QueryClient, job: FlowJob) {
  if (!job.albumMbid) return null;
  return coverArtUrlFrom(
    queryClient.getQueryData<CoverArtResponse>(
      libraryKeys.albumCover(job.albumMbid),
    ),
  );
}

async function fillQueueCovers(queryClient: QueryClient, items: PlayerTrack[]) {
  const albums = new Map<string, AlbumCoverHints>();
  for (const item of items) {
    if (item.albumMbid && !item.artwork && !item.coverPath) {
      albums.set(item.albumMbid, {
        artistName: item.artist,
        albumTitle: item.album || undefined,
      });
    }
  }

  const pending = [...albums];
  for (let i = 0; i < pending.length; i += COVER_LOOKUPS_AT_ONCE) {
    const found = await Promise.all(
      pending
        .slice(i, i + COVER_LOOKUPS_AT_ONCE)
        .map(async ([mbid, hints]): Promise<[string, string | null]> => {
          const cover = await queryClient
            .fetchQuery(albumCoverQuery(mbid, hints))
            .catch(() => undefined);
          return [mbid, coverArtUrlFrom(cover)];
        }),
    );
    const covers = new Map(
      found.filter((entry): entry is [string, string] => entry[1] !== null),
    );
    if (covers.size > 0) await setQueuedAlbumCovers(covers).catch(() => {});
  }
}

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
          jobToPlayerTrack(job, collection, loadedAlbumCover(queryClient, job)),
        )
        .filter((item): item is PlayerTrack => item !== null);
      // Starting a track the queue doesn't hold would drop the old queue and
      // then fail.
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
    canPlay: jobs.some((job) => job.status === "done"),
    playFrom,
    playAll,
    shuffle,
  };
}
