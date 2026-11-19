import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { toastNotSaved } from "@/hooks/offline/toast-not-saved";
import { fillQueueCovers } from "@/hooks/player/queue-covers";
import {
  rememberSongCovers,
  type SavedItem,
  type SavedSong,
  type SaveStatus,
} from "@/lib/offline/saved-library";
import { playQueueFrom } from "@/lib/player/player";
import { toPlayableTrack } from "@/lib/player/saved-queue";
import {
  jobToPlayerTrack,
  toPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";

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

/** Everything saved on the phone, played as one queue from Library › Offline. */
export const OFFLINE: PlayerAlbumContext = {
  ...SAVED_SONGS,
  albumTitle: "Offline",
};

/**
 * Every saved album's, playlist's and song's tracks as one queue, in the order
 * Offline lists them. A song saved on its own and with its album plays once.
 */
export function offlineQueue(saves: readonly SaveStatus[]): PlayerTrack[] {
  const seen = new Set<string>();
  const items: PlayerTrack[] = [];
  const add = (item: PlayerTrack | null) => {
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };
  const byKind = (kind: SavedItem["kind"]) =>
    saves.filter((save) => save.item.kind === kind).map((save) => save.item);

  for (const item of byKind("album")) {
    if (item.kind !== "album") continue;
    const context: PlayerAlbumContext = {
      albumTitle: item.route.title,
      artistName: item.route.artistName,
      coverPath: item.route.coverUrl || null,
      artworkUrl: null,
      albumMbid: item.route.albumMbid || null,
      artistMbid: item.route.artistMbid || null,
      albumRef: item.id,
    };
    item.tracks.forEach((track) => add(toPlayerTrack(track, context)));
  }
  for (const item of byKind("playlist")) {
    if (item.kind !== "playlist") continue;
    const collection = { ...item.playlist, kind: "shared" as const };
    item.jobs.forEach((job) => add(jobToPlayerTrack(job, collection)));
  }
  for (const item of byKind("song")) {
    if (item.kind !== "song") continue;
    add(toPlayableTrack(item.track, SAVED_SONGS));
  }
  return items;
}
