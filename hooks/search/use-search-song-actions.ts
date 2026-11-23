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
import { catalogSongClip, catalogSongContext } from "@/lib/search-results";
import type { CatalogSong, LibrarySearchTrack } from "@/lib/types/search";

/**
 * A Library song in search results plays on its own, as on the web, and
 * Autoplay carries on after it. A catalog song's actions act on its clip, as a
 * Top Tracks clip's do.
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

  const openCatalogActions = useCallback(
    (song: CatalogSong) =>
      // Built at the tap: the URL carries the session token.
      openItem(catalogSongClip(song), catalogSongContext(song), {
        title: song.title,
        // A clip is only a cut of the song, not a file to keep.
        canSaveOffline: false,
      }),
    [openItem],
  );

  return {
    play,
    openActions,
    openCatalogActions,
    actionsTarget: target,
    closeActions: close,
  };
}
