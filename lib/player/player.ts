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
  type TrackItem,
} from "react-native-nitro-player";
// The engine's native callbacks hold a single listener each — registering
// directly on TrackPlayer would clobber the engine's own hooks (useNowPlaying
// and friends), which all multiplex through this manager. The manager is not
// re-exported from the package root, so this reaches into its module.
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";

/**
 * The player facade — the only module in the app that imports the audio
 * engine. Every sound goes through here: owned tracks and preview clips.
 * One engine holds one thing, so starting either replaces the other; no
 * coordination between them is needed.
 *
 * The facade keeps exactly one playlist — the queue — and rebuilds it per
 * play. Transport (next, previous, shuffle, repeat) operates on that queue.
 */

/** The name the engine shows for the current playlist. */
const PLAYLIST_NAME = "Aurral";

let currentPlaylistId: string | null = null;
let configureOnce: Promise<void> | null = null;
let lastPlay: Promise<void> = Promise.resolve();

/**
 * The queue as the facade arranged it. The engine has no shuffle of its own,
 * so the facade remembers both the order it last applied and the original
 * album order that unshuffle restores.
 */
let queueOrder: PlayerTrack[] = [];
let originalOrder: PlayerTrack[] = [];

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
 * track should use playAlbumFromTrack instead.
 *
 * Taps are not awaited by the UI, so overlapping calls are chained: each
 * replacement runs whole, and the last tap wins. Interleaved, one call could
 * play against a playlist another call just deleted.
 */
export function playItem(item: PlayerTrack): Promise<void> {
  const run = lastPlay.then(() => replaceAndPlay([item], item.id));
  // A failed play must not wedge every later one.
  lastPlay = run.catch(() => {});
  return run;
}

/**
 * Play one track from an album, queueing the whole album in order. The whole
 * album — not just the remainder — so previous can walk back past the tapped
 * track and repeat-all cycles the full album. Returns false — not an error —
 * when the tapped track cannot play: Aurral has no readable file for it, or
 * the session token is gone.
 */
export async function playAlbumFromTrack(
  tracks: Track[],
  startTrack: Track,
  album: PlayerAlbumContext,
): Promise<boolean> {
  const startItem = toPlayerTrack(startTrack, album);
  if (!startItem) return false;

  const items = tracks
    .map((track) => toPlayerTrack(track, album))
    .filter((item): item is PlayerTrack => item !== null);

  const run = lastPlay.then(() => replaceAndPlay(items, startItem.id));
  lastPlay = run.catch(() => {});
  await run;
  return true;
}

async function replaceAndPlay(
  items: PlayerTrack[],
  startId: string,
): Promise<void> {
  await configureEngine();

  if (currentPlaylistId) {
    await PlayerQueue.deletePlaylist(currentPlaylistId);
  }
  const playlistId = await PlayerQueue.createPlaylist(PLAYLIST_NAME);
  currentPlaylistId = playlistId;
  queueOrder = items;
  originalOrder = items;
  await PlayerQueue.addTracksToPlaylist(playlistId, items);
  await PlayerQueue.loadPlaylist(playlistId);
  await TrackPlayer.playSong(startId, playlistId);
  await TrackPlayer.play();
}

export async function pause(): Promise<void> {
  await TrackPlayer.pause();
}

export async function resume(): Promise<void> {
  await TrackPlayer.play();
}

export async function next(): Promise<void> {
  await TrackPlayer.skipToNext();
}

type Listener<T> = (value: T) => void;

/** Progress through the current track, for play-history recording. */
export type PlaybackProgress = {
  trackId: string;
  /** Seconds into the track. */
  position: number;
  /** Track length in seconds. Zero while the engine does not know it yet. */
  duration: number;
};

const trackStartedListeners = new Set<Listener<PlayerTrack>>();
const progressListeners = new Set<Listener<PlaybackProgress>>();
const trackCompletedListeners = new Set<Listener<PlayerTrack>>();

let engineEventsWired = false;
/** The current track per the last track-change event. */
let currentEventTrack: PlayerTrack | null = null;

function wireEngineEvents(): void {
  if (engineEventsWired) return;
  engineEventsWired = true;

  callbackManager.subscribeToTrackChange(
    function handleTrackChange(engineTrack, reason): void {
      const started = asPlayerTrack(engineTrack);
      // The engine reports the end of one track as the start of the next,
      // reason "end". A skip is not a completion.
      const completed = reason === "end" ? currentEventTrack : null;
      currentEventTrack = started;
      if (completed) {
        trackCompletedListeners.forEach((listener) => listener(completed));
      }
      trackStartedListeners.forEach((listener) => listener(started));
    },
  );
  callbackManager.subscribeToPlaybackProgressChange(
    function handleProgress(position, totalDuration): void {
      if (!currentEventTrack) return;
      const progress = {
        trackId: currentEventTrack.id,
        position,
        duration: totalDuration,
      };
      progressListeners.forEach((listener) => listener(progress));
    },
  );
  callbackManager.subscribeToPlaybackState(
    function handleStateChange(state, reason): void {
      // The last track has no next track to change onto — its completion
      // arrives as the engine stopping, reason "end".
      if (state !== "stopped" || reason !== "end") return;
      const completed = currentEventTrack;
      if (!completed) return;
      currentEventTrack = null;
      trackCompletedListeners.forEach((listener) => listener(completed));
    },
  );
}

/**
 * The queue's own item for an engine track, so listeners get back exactly
 * what the facade queued. Falls back to normalizing the engine's shape for
 * items the facade did not queue (a preview clip mid-transition).
 */
function asPlayerTrack(engineTrack: TrackItem): PlayerTrack {
  const queued = queueOrder.find((item) => item.id === engineTrack.id);
  if (queued) return queued;
  return {
    id: engineTrack.id,
    title: engineTrack.title,
    artist: engineTrack.artist,
    album: engineTrack.album,
    duration: engineTrack.duration,
    url: engineTrack.url,
    artwork: engineTrack.artwork ?? null,
  };
}

/** Hear about every track the player moves onto. Returns unsubscribe. */
export function onTrackStarted(listener: Listener<PlayerTrack>): () => void {
  wireEngineEvents();
  trackStartedListeners.add(listener);
  return function unsubscribe(): void {
    trackStartedListeners.delete(listener);
  };
}

/** Hear how far the current track has played. Returns unsubscribe. */
export function onProgress(listener: Listener<PlaybackProgress>): () => void {
  wireEngineEvents();
  progressListeners.add(listener);
  return function unsubscribe(): void {
    progressListeners.delete(listener);
  };
}

/** Hear about tracks that played to their natural end. Returns unsubscribe. */
export function onTrackCompleted(listener: Listener<PlayerTrack>): () => void {
  wireEngineEvents();
  trackCompletedListeners.add(listener);
  return function unsubscribe(): void {
    trackCompletedListeners.delete(listener);
  };
}

/**
 * Turn shuffle on or off. On randomizes the upcoming order and leaves what
 * already played — and what is playing — where it is. Off restores the
 * original album order. Reordering in place keeps the current track playing;
 * rebuilding the playlist would restart it.
 *
 * Chained on the play queue for the same reason plays are: reordering a
 * playlist that a pending play is about to delete would land on the wrong one.
 */
export function setShuffle(on: boolean): Promise<void> {
  const run = lastPlay.then(function reorder(): Promise<void> {
    if (on) return shuffleUpcoming();
    return restoreOriginalOrder();
  });
  lastPlay = run.catch(() => {});
  return run;
}

async function shuffleUpcoming(): Promise<void> {
  if (!currentPlaylistId) return;

  const state = await TrackPlayer.getState();
  const currentId = state.currentTrack?.id ?? null;
  // Everything through the current track stays put; -1 (unknown) shuffles all.
  const upcomingStart =
    queueOrder.findIndex((item) => item.id === currentId) + 1;

  await applyOrder(currentPlaylistId, [
    ...queueOrder.slice(0, upcomingStart),
    ...shuffled(queueOrder.slice(upcomingStart)),
  ]);
}

async function restoreOriginalOrder(): Promise<void> {
  if (!currentPlaylistId) return;
  await applyOrder(currentPlaylistId, originalOrder);
}

/** A Fisher–Yates shuffled copy. */
function shuffled(items: PlayerTrack[]): PlayerTrack[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Reorder the engine playlist, move by move, until it matches the target. */
async function applyOrder(
  playlistId: string,
  target: PlayerTrack[],
): Promise<void> {
  const working = queueOrder.map((item) => item.id);
  for (let i = 0; i < target.length; i++) {
    const id = target[i].id;
    if (working[i] === id) continue;
    await PlayerQueue.reorderTrackInPlaylist(playlistId, id, i);
    working.splice(working.indexOf(id), 1);
    working.splice(i, 0, id);
  }
  queueOrder = target;
}

/**
 * Seconds of playback after which "previous" means "start this track over"
 * rather than "go back one track" — the convention every music player uses.
 */
const RESTART_THRESHOLD_SECONDS = 3;

/** Repeat as the app speaks it. "all" repeats the queue, "one" the track. */
export type RepeatMode = "off" | "all" | "one";

const ENGINE_REPEAT_MODE = {
  off: "off",
  all: "Playlist",
  one: "track",
} as const;

export async function setRepeatMode(mode: RepeatMode): Promise<void> {
  await TrackPlayer.setRepeatMode(ENGINE_REPEAT_MODE[mode]);
}

export async function previous(): Promise<void> {
  const state = await TrackPlayer.getState();
  if (state.currentPosition >= RESTART_THRESHOLD_SECONDS) {
    await TrackPlayer.seek(0);
    return;
  }
  await TrackPlayer.skipToPrevious();
}

export type PlayerStatus = {
  /** The id of the queued item that is loaded, or null when nothing is. */
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
