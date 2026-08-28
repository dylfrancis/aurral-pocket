import {
  clearSavedQueue,
  readSavedQueue,
  restorableTracks,
  saveQueue,
  toSavedTrack,
} from "@/lib/player/saved-queue";
import {
  toPlayerTrack,
  type PlayerAlbumContext,
  type PlayerClip,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type { Track } from "@/lib/types/library";
import { useSyncExternalStore } from "react";
import {
  PlayerQueue,
  TrackPlayer,
  useNowPlaying,
  type TrackItem,
} from "react-native-nitro-player";
// The engine's native callbacks hold a single listener each — registering
// directly on TrackPlayer would clobber the engine's own hooks (useNowPlaying
// and friends), which all multiplex through this manager. The manager is not
// re-exported from the package root, so this reaches into its module; the
// dependency is pinned to an exact version because this path is internal.
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
/** Shuffle survives queue rebuilds — a new play comes out shuffled too. */
let shuffleOn = false;
/** Repeat lives in the engine; this mirror is what the UI reads. */
let repeatMode: RepeatMode = "off";

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
export function playItem(item: PlayerClip): Promise<void> {
  const track: PlayerTrack = { ...item, streamPath: null };
  const run = lastPlay.then(() => replaceAndPlay([track], track.id, null));
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

  // A stale or still-loading track list may not hold the tapped track, and
  // playSong with an id that is not in the playlist plays nothing. Queue the
  // tapped track alone rather than silence.
  const queued = items.some((item) => item.id === startItem.id)
    ? items
    : [startItem];

  const run = lastPlay.then(() => replaceAndPlay(queued, startItem.id, album));
  lastPlay = run.catch(() => {});
  await run;
  return true;
}

async function replaceAndPlay(
  items: PlayerTrack[],
  startId: string,
  album: PlayerAlbumContext | null,
): Promise<void> {
  await configureEngine();

  if (currentPlaylistId) {
    await PlayerQueue.deletePlaylist(currentPlaylistId);
  }
  const playlistId = await PlayerQueue.createPlaylist(PLAYLIST_NAME);
  currentPlaylistId = playlistId;
  queueOrder = items;
  originalOrder = items;
  queueAlbumContext = album;
  // Show the started track now, not on the engine's track-change event, so
  // the mini player appears with the tap. The engine's event re-delivers
  // the same object, which listeners compare away.
  endedAtQueueEnd = false;
  pendingRestoreSeek = null;
  resetProgress();
  setDisplayedTrack(items.find((item) => item.id === startId) ?? null);
  refreshQueueSnapshot();
  await PlayerQueue.addTracksToPlaylist(playlistId, items.map(toEngineTrack));
  await PlayerQueue.loadPlaylist(playlistId);
  await TrackPlayer.playSong(startId, playlistId);
  await TrackPlayer.play();
  // A queue rebuilt while shuffle is on must come out shuffled. The started
  // id is known here, so no engine-state round trip is needed.
  if (shuffleOn) {
    await shuffleUpcomingAfter(startId, playlistId);
  }
}

function toEngineTrack(item: PlayerTrack): TrackItem {
  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    album: item.album,
    duration: item.duration,
    url: item.url,
    artwork: item.artwork,
  };
}

export async function pause(): Promise<void> {
  await TrackPlayer.pause();
  persistQueue();
}

/**
 * Pause the engine only while a preview clip holds it — clips are the only
 * queues without an album context. Preview surfaces fire this on blur and
 * on navigation, and album playback must survive those moments.
 */
export async function pauseClip(): Promise<void> {
  if (queueAlbumContext !== null) return;
  await pause();
}

export async function resume(): Promise<void> {
  // The engine loads a restored track after the restore asks it to seek, so
  // the position is asked for once more, now that the track is ready.
  const restored = pendingRestoreSeek;
  pendingRestoreSeek = null;
  if (restored) {
    await TrackPlayer.seek(restored.position);
  }
  await TrackPlayer.play();
}

/**
 * One control for a play/pause button. Pause when playing; resume when
 * paused mid-track. After the queue plays out, resume would produce
 * silence — restart the track the player shows instead.
 */
export function togglePlayback(): Promise<void> {
  if (playbackState === "playing" || playbackState === "buffering") {
    return pause();
  }
  if (endedAtQueueEnd && displayedTrack) {
    return playQueueItem(displayedTrack.id);
  }
  return resume();
}

export async function next(): Promise<void> {
  pendingRestoreSeek = null;
  await TrackPlayer.skipToNext();
}

/** Move playback to a position, in seconds, within the current track. */
export async function seekTo(positionSeconds: number): Promise<void> {
  pendingRestoreSeek = null;
  await TrackPlayer.seek(positionSeconds);
  persistQueue(positionSeconds);
}

/**
 * Jump to a queued track without rebuilding the queue. Chained on the play
 * queue for the same reason plays are: a jump inside a playlist that a
 * pending play is about to delete would land on the wrong one.
 */
export function playQueueItem(id: string): Promise<void> {
  const run = lastPlay.then(async () => {
    if (!currentPlaylistId) return;
    endedAtQueueEnd = false;
    pendingRestoreSeek = null;
    resetProgress();
    setDisplayedTrack(queueOrder.find((item) => item.id === id) ?? null);
    await TrackPlayer.playSong(id, currentPlaylistId);
    await TrackPlayer.play();
  });
  lastPlay = run.catch(() => {});
  return run;
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

// Wake-up calls for the player hooks. They carry no payload — each hook
// re-reads its snapshot below, and useSyncExternalStore drops the render
// when the snapshot did not change.
const displayedTrackListeners = new Set<() => void>();
const playbackStateListeners = new Set<() => void>();
const queueChangedListeners = new Set<() => void>();
const modesChangedListeners = new Set<() => void>();
const progressTickListeners = new Set<() => void>();

let engineEventsWired = false;
/** The current track per the last track-change event. */
let currentEventTrack: PlayerTrack | null = null;
/** The last progress report, for spotting a pause that is really the end. */
let lastProgress: PlaybackProgress | null = null;

/** What playback is doing, as the facade speaks it. */
export type PlaybackState = "playing" | "paused" | "buffering" | "stopped";

/** Shuffle and repeat together, for the controls that toggle them. */
export type PlayerModes = { shuffle: boolean; repeat: RepeatMode };

/** Position within the current track, in seconds, for progress displays. */
export type TrackProgress = { position: number; duration: number };

/** The queue in play order, with the id of the track the player is on. */
export type QueueSnapshot = {
  items: PlayerTrack[];
  currentId: string | null;
  /** The album the queue came from. Null for a single clip. */
  album: PlayerAlbumContext | null;
};

/**
 * The track the player UI shows. It follows the track-change events, but
 * unlike currentEventTrack it survives the natural end of the last track —
 * a finished queue still shows what just played, stopped at its end.
 */
let displayedTrack: PlayerTrack | null = null;
/** The album behind the current queue, for the queue snapshot. */
let queueAlbumContext: PlayerAlbumContext | null = null;
/** The engine's state per its last state-change event. */
let playbackState: PlaybackState = "stopped";
/**
 * True after the queue plays out. The engine then sits at the last track's
 * end, where resume produces silence — the toggle restarts the track
 * instead. Cleared the moment any track starts.
 */
let endedAtQueueEnd = false;
/**
 * Progress at whole-second resolution. The engine ticks several times a
 * second; replacing this snapshot only when a display would change keeps
 * the progress hook's consumers to one render per second.
 */
let progressSnapshot: TrackProgress = { position: 0, duration: 0 };
let queueSnapshot: QueueSnapshot = {
  items: [],
  currentId: null,
  album: null,
};
let modesSnapshot: PlayerModes = { shuffle: false, repeat: "off" };
/** Where a restored queue starts from, until playback moves it. */
let pendingRestoreSeek: {
  trackId: string;
  position: number;
  duration: number;
} | null = null;

function setProgress(position: number, duration: number): void {
  progressSnapshot = { position, duration };
  progressTickListeners.forEach((listener) => listener());
}

function setDisplayedTrack(track: PlayerTrack | null): void {
  if (track === displayedTrack) return;
  displayedTrack = track;
  refreshQueueSnapshot();
  displayedTrackListeners.forEach((listener) => listener());
}

function refreshQueueSnapshot(): void {
  queueSnapshot = {
    items: queueOrder,
    currentId: displayedTrack?.id ?? null,
    album: queueAlbumContext,
  };
  queueChangedListeners.forEach((listener) => listener());
  persistQueue();
}

function notifyModesChanged(): void {
  modesSnapshot = { shuffle: shuffleOn, repeat: repeatMode };
  modesChangedListeners.forEach((listener) => listener());
  persistQueue();
}

/*
 * Saving and restoring the queue. Only a library queue is saved: a preview
 * clip has no album and no path to build a URL from.
 */

/** Seconds of playback between position writes. Ticks arrive far faster. */
const POSITION_SAVE_INTERVAL_SECONDS = 5;

let lastSavedPosition = 0;
/** Writes run one at a time, so a burst of changes cannot land out of order. */
let lastSave: Promise<void> = Promise.resolve();
let restoringQueue = false;

function persistQueue(position?: number): void {
  if (restoringQueue) return;
  const album = queueAlbumContext;
  if (!album || queueOrder.length === 0) return;

  const items = queueOrder.map(toSavedTrack).filter((item) => item !== null);
  if (items.length === 0) return;

  lastSavedPosition = position ?? currentPosition();
  const record = {
    items,
    originalIds: originalOrder.map((item) => item.id),
    currentId: displayedTrack?.id ?? null,
    positionSeconds: lastSavedPosition,
    durationSeconds: progressSnapshot.duration,
    album,
    shuffle: shuffleOn,
    repeat: repeatMode,
  };
  lastSave = lastSave.then(() => saveQueue(record)).catch(() => {});
}

function currentPosition(): number {
  return lastProgress?.position ?? progressSnapshot.position;
}

/** A new play saves and shows its position before the engine reports one. */
function resetProgress(): void {
  lastProgress = null;
  setProgress(0, 0);
}

/**
 * Bring back the queue the last session left, paused where it stopped. Call
 * once at start, after the session token is in place — the stream URLs are
 * built from it. Returns false when nothing comes back.
 *
 * Chained on the play queue for the same reason plays are: a pending play
 * would make "is anything playing" a stale answer.
 */
export function restoreSavedQueue(): Promise<boolean> {
  const run = lastPlay.then(restoreNow);
  lastPlay = run.then(
    () => {},
    () => {},
  );
  return run;
}

async function restoreNow(): Promise<boolean> {
  if (queueOrder.length > 0) return false;

  const saved = await readSavedQueue();
  if (!saved) return false;

  const items = await restorableTracks(saved);
  if (items.length === 0) {
    await clearSavedQueue();
    return false;
  }

  // A dropped saved track sends the queue back to its head.
  const current = items.find((item) => item.id === saved.currentId) ?? items[0];
  const resumed = current.id === saved.currentId;
  const position = resumed ? saved.positionSeconds : 0;
  const duration = resumed ? saved.durationSeconds : 0;

  restoringQueue = true;
  try {
    await configureEngine();
    if (currentPlaylistId) {
      await PlayerQueue.deletePlaylist(currentPlaylistId);
    }
    const playlistId = await PlayerQueue.createPlaylist(PLAYLIST_NAME);
    currentPlaylistId = playlistId;
    queueOrder = items;
    originalOrder = inSavedOrder(items, saved.originalIds);
    queueAlbumContext = saved.album;
    shuffleOn = saved.shuffle;
    repeatMode = saved.repeat;
    endedAtQueueEnd = false;
    pendingRestoreSeek = { trackId: current.id, position, duration };
    setProgress(position, duration);
    setDisplayedTrack(current);
    refreshQueueSnapshot();
    notifyModesChanged();

    await PlayerQueue.addTracksToPlaylist(playlistId, items.map(toEngineTrack));
    // loadPlaylist readies the track without playing it.
    await PlayerQueue.loadPlaylist(playlistId, items.indexOf(current));
    if (repeatMode !== "off") {
      await TrackPlayer.setRepeatMode(ENGINE_REPEAT_MODE[repeatMode]);
    }
    if (position > 0) {
      await TrackPlayer.seek(position);
    }
  } finally {
    restoringQueue = false;
  }

  persistQueue(position);
  return true;
}

function inSavedOrder(items: PlayerTrack[], ids: string[]): PlayerTrack[] {
  const ordered = ids
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is PlayerTrack => item !== undefined);
  return ordered.length === items.length ? ordered : items;
}

/**
 * How close to a track's known end still counts as the end. Progress reports
 * arrive about once a second, so the last one can sit shy of the duration.
 */
const TRACK_END_EPSILON_SECONDS = 2;

function isAtTrackEnd(): boolean {
  return (
    lastProgress !== null &&
    lastProgress.duration > 0 &&
    lastProgress.position >= lastProgress.duration - TRACK_END_EPSILON_SECONDS
  );
}

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
      lastProgress = null;
      endedAtQueueEnd = false;
      setDisplayedTrack(started);
      // A new track starts at zero. Without this reset the scrubber keeps
      // the old track's position until the first tick arrives. A restored
      // track is the exception: it starts where it was saved, at a length
      // the engine has not read from the stream yet.
      const restored =
        pendingRestoreSeek?.trackId === started.id ? pendingRestoreSeek : null;
      if (!restored) pendingRestoreSeek = null;
      setProgress(
        restored?.position ?? 0,
        started.duration || restored?.duration || 0,
      );
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
      lastProgress = progress;
      progressListeners.forEach((listener) => listener(progress));
      // Whole-second resolution — see progressSnapshot.
      if (
        Math.floor(progressSnapshot.position) !== Math.floor(position) ||
        progressSnapshot.duration !== totalDuration
      ) {
        progressSnapshot = { position, duration: totalDuration };
        progressTickListeners.forEach((listener) => listener());
      }
      if (
        Math.abs(position - lastSavedPosition) >= POSITION_SAVE_INTERVAL_SECONDS
      ) {
        persistQueue(position);
      }
    },
  );
  callbackManager.subscribeToPlaybackState(
    function handleStateChange(state, reason): void {
      playbackState = state;
      playbackStateListeners.forEach((listener) => listener());
      // The last track has no next track to change onto. Android reports its
      // completion as the engine stopping, reason "end". iOS reports nothing:
      // the player just pauses at the track's end with no reason, exactly
      // like a user pause — the position tells them apart.
      const endedNaturally = state === "stopped" && reason === "end";
      const endedSilently =
        (state === "stopped" || state === "paused") &&
        reason === undefined &&
        isAtTrackEnd();
      if (!endedNaturally && !endedSilently) return;
      const completed = currentEventTrack;
      if (!completed) return;
      currentEventTrack = null;
      lastProgress = null;
      endedAtQueueEnd = true;
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
    streamPath: null,
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
  shuffleOn = on;
  notifyModesChanged();
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
  await shuffleUpcomingAfter(state.currentTrack?.id ?? null, currentPlaylistId);
}

async function shuffleUpcomingAfter(
  currentId: string | null,
  playlistId: string,
): Promise<void> {
  // Everything through the current track stays put; -1 (unknown) shuffles all.
  const upcomingStart =
    queueOrder.findIndex((item) => item.id === currentId) + 1;

  await applyOrder(playlistId, [
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
  refreshQueueSnapshot();
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
  repeatMode = mode;
  notifyModesChanged();
  await TrackPlayer.setRepeatMode(ENGINE_REPEAT_MODE[mode]);
}

export async function previous(): Promise<void> {
  pendingRestoreSeek = null;
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

/*
 * The hooks below each subscribe to one kind of change. usePlayerStatus
 * re-renders its consumer on every progress tick; these do not. The player
 * bar and transport controls read track, state, queue, and modes, so a tick
 * only reaches the components that display progress.
 */

function makeSubscribe(listeners: Set<() => void>) {
  return function subscribe(onStoreChange: () => void): () => void {
    wireEngineEvents();
    listeners.add(onStoreChange);
    return function unsubscribe(): void {
      listeners.delete(onStoreChange);
    };
  };
}

const subscribeDisplayedTrack = makeSubscribe(displayedTrackListeners);
const subscribePlaybackState = makeSubscribe(playbackStateListeners);
const subscribeProgressTicks = makeSubscribe(progressTickListeners);
const subscribeQueueChanged = makeSubscribe(queueChangedListeners);
const subscribeModesChanged = makeSubscribe(modesChangedListeners);

const getDisplayedTrack = () => displayedTrack;
const getPlaybackState = () => playbackState;
const getProgressSnapshot = () => progressSnapshot;
const getQueueSnapshot = () => queueSnapshot;
const getHasQueue = () => queueSnapshot.items.length > 0;
const getModesSnapshot = () => modesSnapshot;

/** The track the player is on. It stays visible after the queue runs out. */
export function useCurrentTrack(): PlayerTrack | null {
  return useSyncExternalStore(
    subscribeDisplayedTrack,
    getDisplayedTrack,
    getDisplayedTrack,
  );
}

/** What playback is doing. No re-render on progress ticks. */
export function usePlaybackState(): PlaybackState {
  return useSyncExternalStore(
    subscribePlaybackState,
    getPlaybackState,
    getPlaybackState,
  );
}

/** Position and duration, updated once a second. For progress displays only. */
export function useProgress(): TrackProgress {
  return useSyncExternalStore(
    subscribeProgressTicks,
    getProgressSnapshot,
    getProgressSnapshot,
  );
}

/** The queue in play order, with the id of the track the player is on. */
export function useQueue(): QueueSnapshot {
  return useSyncExternalStore(
    subscribeQueueChanged,
    getQueueSnapshot,
    getQueueSnapshot,
  );
}

/** True while anything is queued. Drives the player bar's visibility. */
export function useHasQueue(): boolean {
  return useSyncExternalStore(subscribeQueueChanged, getHasQueue, getHasQueue);
}

/** Shuffle and repeat, for the controls that toggle them. */
export function usePlayerModes(): PlayerModes {
  return useSyncExternalStore(
    subscribeModesChanged,
    getModesSnapshot,
    getModesSnapshot,
  );
}
