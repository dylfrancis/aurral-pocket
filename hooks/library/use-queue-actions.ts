import { useCallback } from "react";
import * as Burnt from "burnt";
import {
  addToQueue,
  playAlbumFromTrack,
  playNextInQueue,
  setShuffle,
} from "@/lib/player/player";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import type { Track } from "@/lib/types/library";

/**
 * The queue and album-level play actions, with their user feedback. Every
 * action says what happened: a queue edit confirms itself with a toast, and
 * a failure explains itself instead of looking like a dead tap.
 */
export function useQueueActions() {
  const playNext = useCallback(
    async (tracks: Track[], album: PlayerAlbumContext) => {
      try {
        const added = await playNextInQueue(tracks, album);
        if (added > 0) {
          Burnt.toast({ title: "Playing next", preset: "done" });
          return;
        }
        toastNothingQueued();
      } catch (error) {
        toastFailure(error);
      }
    },
    [],
  );

  const addLast = useCallback(
    async (tracks: Track[], album: PlayerAlbumContext) => {
      try {
        const added = await addToQueue(tracks, album);
        if (added > 0) {
          Burnt.toast({ title: "Added to queue", preset: "done" });
          return;
        }
        toastNothingQueued();
      } catch (error) {
        toastFailure(error);
      }
    },
    [],
  );

  const playAlbum = useCallback(
    async (tracks: Track[], album: PlayerAlbumContext) => {
      const first = firstPlayable(tracks);
      if (!first) {
        toastNothingPlayable();
        return;
      }
      try {
        const started = await playAlbumFromTrack(tracks, first, album);
        if (!started) toastNothingPlayable();
      } catch (error) {
        toastFailure(error);
      }
    },
    [],
  );

  // Turning shuffle on before the play makes the rebuilt queue come out
  // shuffled — replaceAndPlay reorders the upcoming tracks itself.
  const shuffleAlbum = useCallback(
    async (tracks: Track[], album: PlayerAlbumContext) => {
      const playable = tracks.filter((track) => track.streamPath);
      if (playable.length === 0) {
        toastNothingPlayable();
        return;
      }
      const start = playable[Math.floor(Math.random() * playable.length)];
      try {
        await setShuffle(true);
        const started = await playAlbumFromTrack(tracks, start, album);
        if (!started) toastNothingPlayable();
      } catch (error) {
        toastFailure(error);
      }
    },
    [],
  );

  return { playNext, addToQueue: addLast, playAlbum, shuffleAlbum };
}

function firstPlayable(tracks: Track[]): Track | null {
  return tracks.find((track) => track.streamPath) ?? null;
}

function toastNothingQueued(): void {
  Burnt.toast({
    title: "Nothing to add",
    message:
      "Aurral has no readable files for these tracks, or they are already in the queue.",
    preset: "error",
  });
}

function toastNothingPlayable(): void {
  Burnt.toast({
    title: "Cannot play this album",
    message:
      "Aurral has no file it can read for any track. Check that its music folder is mounted.",
    preset: "error",
  });
}

function toastFailure(error: unknown): void {
  Burnt.toast({
    title: "Playback failed",
    message: error instanceof Error ? error.message : String(error),
    preset: "error",
  });
}
