import { useCallback, useMemo } from "react";
import { useTrackActions } from "@/components/library/TrackActionsSheet";
import { useStartQueue } from "@/hooks/player/use-start-queue";
import {
  togglePlayback,
  useCurrentTrack,
  usePlaybackState,
} from "@/lib/player/player";
import type { PlayerAlbumContext, PlayerTrack } from "@/lib/player/track-item";
import { topTrackClipId, topTrackItem, type TopTrack } from "@/lib/top-tracks";

/**
 * Plays a list as one queue from any row or the top. `items` runs at the tap,
 * since each URL carries the session token.
 */
export function useQueuePlayback(
  itemIds: string[],
  items: () => PlayerTrack[],
  context: PlayerAlbumContext,
) {
  const startQueue = useStartQueue();
  const currentTrack = useCurrentTrack();
  const playbackState = usePlaybackState();

  /** The row already playing pauses or resumes instead. */
  const playFrom = useCallback(
    (index: number) => {
      const id = itemIds[index];
      if (id === currentTrack?.id) {
        void togglePlayback();
        return;
      }
      void startQueue(items(), context, { startId: id });
    },
    [itemIds, currentTrack?.id, startQueue, items, context],
  );
  const playAll = useCallback(
    () => void startQueue(items(), context, { startId: itemIds[0] }),
    [startQueue, items, context, itemIds],
  );

  return {
    itemIds,
    currentId: currentTrack?.id ?? null,
    isPlaying: playbackState === "playing",
    playFrom,
    playAll,
  };
}

/**
 * Plays an artist's top tracks as one queue, from any row, and opens a row's
 * actions. Render a TrackActionsSheet with `actions`.
 */
export function useTopTracksPlayback(
  topTracks: TopTrack[],
  artistName: string,
  mbid: string | undefined,
) {
  const context = useMemo<PlayerAlbumContext>(
    () => ({
      albumTitle: "Top Tracks",
      artistName,
      coverPath: null,
      artworkUrl: null,
      albumMbid: null,
      artistMbid: mbid ?? null,
    }),
    [artistName, mbid],
  );
  const itemIds = useMemo(
    () =>
      topTracks.map((topTrack) =>
        topTrack.library
          ? topTrack.library.id
          : topTrackClipId(topTrack.preview),
      ),
    [topTracks],
  );
  const items = useCallback(
    () =>
      topTracks
        .map((topTrack) =>
          topTrackItem(topTrack, { name: artistName, mbid: mbid ?? "" }),
        )
        .filter((item): item is PlayerTrack => item !== null),
    [topTracks, artistName, mbid],
  );
  const playback = useQueuePlayback(itemIds, items, context);

  const actions = useTrackActions();
  const { openItem } = actions;
  const openActions = useCallback(
    (index: number) => {
      const topTrack = topTracks[index];
      if (!topTrack) return;
      openItem(
        topTrackItem(topTrack, { name: artistName, mbid: mbid ?? "" }),
        context,
        {
          title: topTrack.library?.title ?? topTrack.preview.title,
          // A clip is only a cut of the song, not a file to keep.
          canSaveOffline: !!topTrack.library,
        },
      );
    },
    [topTracks, openItem, artistName, mbid, context],
  );

  return { ...playback, openActions, actions };
}
