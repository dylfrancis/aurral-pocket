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
 * The player facade — the only module in the app that imports the audio
 * engine. Every sound goes through here: owned tracks and preview clips.
 * One engine holds one thing, so starting either replaces the other; no
 * coordination between them is needed.
 *
 * The engine plays from a playlist, so a single item still needs one. This
 * slice keeps exactly one playlist and rebuilds it per item. A real queue
 * arrives in a later slice.
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
 * Play one item, replacing whatever is playing. Callers that hold a library
 * track should use playTrack instead.
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
  // playSong only cues. Without an explicit play() the track sits silent on
  // the lock screen until the user presses play there.
  await TrackPlayer.play();
}

/**
 * Play one owned track. Returns false — not an error — when the track cannot
 * play: Aurral has no readable file for it, or the session token is gone.
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

export async function pause(): Promise<void> {
  await TrackPlayer.pause();
}

export async function resume(): Promise<void> {
  await TrackPlayer.play();
}

export type PlayerStatus = {
  /** The id the caller handed playItem, or null when nothing is loaded. */
  currentId: string | null;
  isPlaying: boolean;
  isBuffering: boolean;
  /**
   * Paused mid-item, so resume continues it. A finished item is not paused —
   * it sits stopped at its end, and resuming there produces silence. Reload
   * instead when every flag is false.
   */
  isPaused: boolean;
  /** How far through the item, from 0 to 1. Zero while the length is unknown. */
  progress: number;
};

export function usePlayerStatus(): PlayerStatus {
  const state = useNowPlaying();
  return {
    currentId: state.currentTrack?.id ?? null,
    isPlaying: state.currentState === "playing",
    isBuffering: state.currentState === "buffering",
    isPaused: state.currentState === "paused",
    progress:
      state.totalDuration > 0 ? state.currentPosition / state.totalDuration : 0,
  };
}
