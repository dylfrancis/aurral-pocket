import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTrackActions } from "@/components/library/TrackActionsSheet";
import { playOrExplain } from "@/hooks/library/use-play-track";
import { cachedAlbumCover } from "@/hooks/player/queue-covers";
import { playQueueFrom } from "@/lib/player/player";
import {
  searchTrackContext,
  searchTrackToPlayerTrack,
} from "@/lib/player/track-item";
import type { LibrarySearchTrack } from "@/lib/types/search";

/**
 * A Library song in search results plays on its own, as on the web, and
 * Autoplay carries on after it.
 */
export function useSearchSongActions() {
  const queryClient = useQueryClient();
  const { target, openItem, close } = useTrackActions();

  // Built at the tap: the URL carries the session token.
  const playerItem = useCallback(
    (track: LibrarySearchTrack) => {
      const album = searchTrackContext(
        track,
        cachedAlbumCover(queryClient, track.albumMbid),
      );
      return { item: searchTrackToPlayerTrack(track, album), album };
    },
    [queryClient],
  );

  const play = useCallback(
    (track: LibrarySearchTrack) =>
      playOrExplain(async () => {
        const { item, album } = playerItem(track);
        return item !== null && playQueueFrom([item], item.id, album);
      }),
    [playerItem],
  );

  const openActions = useCallback(
    (track: LibrarySearchTrack) => {
      const { item, album } = playerItem(track);
      openItem(item, album, { title: track.title });
    },
    [playerItem, openItem],
  );

  return { play, openActions, actionsTarget: target, closeActions: close };
}
