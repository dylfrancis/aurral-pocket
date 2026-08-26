import {
  toPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type { Track } from "@/lib/types/library";
import {
  PlayerQueue,
  TrackPlayer,
  useNowPlaying,
} from "react-native-nitro-player";

/**
 * The player facade.
 *
 * This is the only module in the app that imports the audio engine. Screens,
 * hooks, and mappers call the functions below instead. Keeping the import in
 * one place means the engine can be replaced without touching the app, and it
 * keeps engine objects out of the React tree.
 *
 * Every sound in the app goes through here: owned tracks streamed from the
 * server, and the thirty-second clips that the search and flow screens play.
 * One engine holds one thing, so starting either one ends the other. That is
 * why no separate coordination between the two exists.
 *
 * The engine plays from a playlist, so a single item still needs one. This
 * slice keeps exactly one playlist and rebuilds it per item. A real queue with
 * next and previous arrives in a later slice.
 */

/** The name the engine shows for the current playlist. */
const PLAYLIST_NAME = "Aurral";

let currentPlaylistId: string | null = null;
let configureOnce: Promise<void> | null = null;

function configureEngine(): Promise<void> {
  configureOnce ??= TrackPlayer.configure({
    // The notification is what drives the lock screen and headset buttons.
    showInNotification: true,
    androidAutoEnabled: false,
    carPlayEnabled: false,
  });
  return configureOnce;
}

/**
 * Play one item, replacing whatever is playing.
 *
 * Callers that hold a library track should use playTrack instead. This is the
 * entry point for a clip, whose URL comes from a preview provider rather than
 * from the canonical stream route.
 */
export async function playItem(item: PlayerTrack): Promise<void> {
  await configureEngine();

  if (currentPlaylistId) {
    await PlayerQueue.deletePlaylist(currentPlaylistId);
  }
  currentPlaylistId = await PlayerQueue.createPlaylist(PLAYLIST_NAME);
  await PlayerQueue.addTracksToPlaylist(currentPlaylistId, [item]);
  await PlayerQueue.loadPlaylist(currentPlaylistId);
  await TrackPlayer.playSong(item.id, currentPlaylistId);
}

/**
 * Play one owned track.
 *
 * Returns false when the track cannot play, which happens when Aurral has no
 * readable file for it or when the session token is gone. The caller leaves
 * the row as it is; false is not an error.
 */
export async function playTrack(
  track: Track,
  album: PlayerAlbumContext,
): Promise<boolean> {
  const item = toPlayerTrack(track, album);
  if (!item) return false;
  await playItem(item);
  return true;
}

/** Pause whatever is playing. */
export async function pause(): Promise<void> {
  await TrackPlayer.pause();
}

/** Resume the paused item. */
export async function resume(): Promise<void> {
  await TrackPlayer.play();
}

/** What the player is doing right now, as a screen needs to read it. */
export type PlayerStatus = {
  /** The id the caller handed playItem, or null when nothing is loaded. */
  currentId: string | null;
  isPlaying: boolean;
  isBuffering: boolean;
  /** How far through the item, from 0 to 1. Zero while the length is unknown. */
  progress: number;
};

/** Subscribe a screen to the player. */
export function usePlayerStatus(): PlayerStatus {
  const state = useNowPlaying();
  return {
    currentId: state.currentTrack?.id ?? null,
    isPlaying: state.currentState === "playing",
    isBuffering: state.currentState === "buffering",
    progress:
      state.totalDuration > 0 ? state.currentPosition / state.totalDuration : 0,
  };
}
