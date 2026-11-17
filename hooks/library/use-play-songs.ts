import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { albumTrackContext } from "@/hooks/library/album-track-context";
import { playOrExplain } from "@/hooks/library/use-play-track";
import { playQueueFrom } from "@/lib/player/player";
import {
  toPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type { AlbumTrack } from "@/lib/types/library";

/** Songs come from many albums, so the queue is named for the list. */
export const LIBRARY_SONGS: PlayerAlbumContext = {
  albumTitle: "Songs",
  artistName: "",
  coverPath: null,
  artworkUrl: null,
  albumMbid: null,
  artistMbid: null,
};

/**
 * Play the songs loaded so far, in the list's order, from the tapped one, as
 * the web's track list does. Each keeps its own album on the lock screen, and
 * every Library album has a server cover, so no cover lookups are needed.
 */
export function usePlaySongs() {
  const queryClient = useQueryClient();
  return useCallback(
    (songs: AlbumTrack[], start: AlbumTrack) =>
      playOrExplain(() => {
        // Built at the tap: each URL carries the session token.
        const items = songs
          .map((song) =>
            toPlayerTrack(song, albumTrackContext(song, queryClient)),
          )
          .filter((item): item is PlayerTrack => item !== null);
        return playQueueFrom(items, start.id, LIBRARY_SONGS);
      }),
    [queryClient],
  );
}
