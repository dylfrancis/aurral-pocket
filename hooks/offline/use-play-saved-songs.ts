import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { toastNotSaved } from "@/hooks/offline/toast-not-saved";
import { fillQueueCovers } from "@/hooks/player/queue-covers";
import {
  rememberSongCovers,
  type SavedSong,
} from "@/lib/offline/saved-library";
import { playQueueFrom } from "@/lib/player/player";
import { toPlayableTrack } from "@/lib/player/saved-queue";
import type { PlayerAlbumContext, PlayerTrack } from "@/lib/player/track-item";

/** Songs saved on their own come from many albums, so the queue is named. */
export const SAVED_SONGS: PlayerAlbumContext = {
  albumTitle: "Saved Songs",
  artistName: "",
  coverPath: null,
  artworkUrl: null,
  albumMbid: null,
  artistMbid: null,
};

/** Play the songs saved on their own, in their order, from one of them. */
export function usePlaySavedSongs() {
  const queryClient = useQueryClient();
  return useCallback(
    async (songs: SavedSong[], startId: string) => {
      const items = songs
        .map((song) => toPlayableTrack(song.track, SAVED_SONGS))
        .filter((item): item is PlayerTrack => item !== null);
      try {
        const started = await playQueueFrom(items, startId, SAVED_SONGS);
        if (!started) {
          toastNotSaved();
          return;
        }
        // A song saved before it had a cover gets one now, while there's a
        // connection, and keeps it. The playing one goes first: it's on screen.
        const first = items.find((item) => item.id === startId);
        void fillQueueCovers(queryClient, first ? [first, ...items] : items)
          .then(rememberSongCovers)
          .catch(() => {});
      } catch (error) {
        Burnt.toast({
          title: "Playback failed",
          message: error instanceof Error ? error.message : String(error),
          preset: "error",
        });
      }
    },
    [queryClient],
  );
}
