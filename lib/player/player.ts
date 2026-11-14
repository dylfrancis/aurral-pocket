import {
  clearSavedQueue,
  readSavedQueue,
  restorableTracks,
  saveQueue,
  toSavedTrack,
} from "@/lib/player/saved-queue";
import {
  insertedAt,
  insertIndexAfter,
  withoutQueuedIds,
} from "@/lib/player/queue-edits";
import {
  toPlayerTrack,
  type PlayerAlbumContext,
  type PlayerClip,
  type PlayerTrack,
} from "@/lib/player/track-item";
import {
  authenticatedImageUrl,
  buildAuthenticatedUrl,
  customHeadersFor,
} from "@/lib/api/client";
import {
  audioCacheReady,
  cachedFilePath,
  markPlayed,
  onCachedFilesChange,
  setPrefetchWindow,
  type PrefetchTrack,
} from "@/lib/offline/audio-cache";
import {
  isOffline,
  networkKnown,
  onNetworkChange,
} from "@/lib/offline/network";
import {
  canPlayNow,
  savedFilePath,
  savedLibraryReady,
} from "@/lib/offline/saved-library";
import {
  getPlaybackSettings,
  onPlaybackSettingsChange,
  playbackSettingsReady,
} from "@/lib/player/playback-settings";
import { limitQueue } from "@/lib/player/queue-limit";
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
 * Delete every playlist the engine holds, not only the facade's queue. The
 * engine saves its playlists to disk and loads them back when it starts, and
 * each saved track keeps its stream URL, session token included. The facade
 * forgets its playlist id on a restart, so without this every cold start
 * leaves one more playlist behind.
 *
 * Pocket is the engine's only user, and a restore rebuilds the queue from
 * pocket's own saved record, so nothing the engine kept is needed. Best
 * effort: one playlist that will not delete does not stop the others, and a
 * failure here must not stop the restore or the sign-out that asked for it.
 */
async function deleteEnginePlaylists(): Promise<void> {
  try {
    const deletes = PlayerQueue.getAllPlaylists().map((playlist) =>
      PlayerQueue.deletePlaylist(playlist.id),
    );
    await Promise.allSettled(deletes);
  } catch {}
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
  // A preview clip is not a library track: it has no ids, and no play of it
  // is ever reported.
  const track: PlayerTrack = {
    ...item,
    streamPath: null,
    coverPath: null,
    trackMbid: null,
    artistMbid: null,
    albumMbid: null,
    favorite: null,
  };
  const run = lastPlay.then(async () => {
    await replaceAndPlay([track], track.id, null);
  });
  // A failed play must not wedge every later one.
  lastPlay = run.catch(() => {});
  return run;
}

/**
 * Play one track from an album, queueing the whole album in order. The whole
 * album — not just the remainder — so previous can walk back past the tapped
 * track and repeat-all cycles the full album. A queue length set in Settings
 * cuts it to the tapped track and the ones after it. Returns false — not an
 * error —
 * when the tapped track cannot play: Aurral has no readable file for it, or
 * the session token is gone, or the phone is offline and the track isn't saved.
 */
export async function playAlbumFromTrack(
  tracks: Track[],
  startTrack: Track,
  album: PlayerAlbumContext,
): Promise<boolean> {
  const startItem = toPlayerTrack(startTrack, album);
  if (!startItem || !canPlayNow(startItem.id)) return false;

  const items = playableNow(
    tracks
      .map((track) => toPlayerTrack(track, album))
      .filter((item): item is PlayerTrack => item !== null),
  );

  // A stale or still-loading track list may not hold the tapped track, and the
  // engine refuses to start a track that is not in the playlist. Queue the
  // tapped track alone rather than fail.
  const queued = items.some((item) => item.id === startItem.id)
    ? items
    : [startItem];

  const run = lastPlay.then(() => replaceAndPlay(queued, startItem.id, album));
  lastPlay = run.then(
    () => {},
    () => {},
  );
  await run;
  return true;
}

/** Returns how many tracks the queue took, after the queue length in Settings. */
async function replaceAndPlay(
  tracks: PlayerTrack[],
  startId: string,
  album: PlayerAlbumContext | null,
): Promise<number> {
  await Promise.all([configureEngine(), playbackSettingsReady()]);
  const { queue: items, original } = limitQueue(
    tracks,
    startId,
    getPlaybackSettings().queueLimit,
    shuffleOn,
  );

  if (currentPlaylistId) {
    await PlayerQueue.deletePlaylist(currentPlaylistId);
  }
  const playlistId = await PlayerQueue.createPlaylist(PLAYLIST_NAME);
  currentPlaylistId = playlistId;
  queueOrder = items;
  originalOrder = original;
  queueAlbumContext = album;
  // Show the started track now, not on the engine's track-change event, so
  // the mini player appears with the tap. The engine's event re-delivers
  // the same object, which listeners compare away.
  endedAtQueueEnd = false;
  pendingRestoreSeek = null;
  resetProgress();
  const startIndex = items.findIndex((item) => item.id === startId);
  setDisplayedTrack(items[startIndex] ?? null);
  refreshQueueSnapshot();
  await PlayerQueue.addTracksToPlaylist(playlistId, items.map(toEngineTrack));
  // Without an index the engine loads from the top and reports the first track,
  // which would replace the started one on screen. The load already puts the
  // started track in place, so a playSong after it would start the track over.
  await PlayerQueue.loadPlaylist(playlistId, startIndex);
  await TrackPlayer.play();
  // A queue rebuilt while shuffle is on must come out shuffled. The started
  // id is known here, so no engine-state round trip is needed.
  if (shuffleOn) {
    await shuffleUpcomingAfter(startId, playlistId);
  }
  return items.length;
}

/** A track saved offline or fetched ahead plays from its file. */
function localFilePath(id: string): string | null {
  return savedFilePath(id) ?? cachedFilePath(id);
}

function toEngineTrack(item: PlayerTrack): TrackItem {
  // The engine fetches the lock screen's image with no session header, so the
  // cover needs a token in its URL. It is added here, on the way out, so the
  // queue and its saved copy never hold a token for artwork.
  const artwork = authenticatedImageUrl(item.coverPath) ?? item.artwork;
  // A saved or fetched track plays from its file, connection or not.
  const url = localFilePath(item.id) ?? item.url;
  // Worked out per URL, so a Deezer clip, a cover or a file gets no custom
  // headers.
  const headers = customHeadersFor(url);
  const artworkHeaders = artwork ? customHeadersFor(artwork) : {};
  const hasHeaders =
    Object.keys(headers).length > 0 || Object.keys(artworkHeaders).length > 0;
  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    album: item.album,
    duration: item.duration,
    url,
    artwork,
    ...(hasHeaders ? { extraPayload: { headers, artworkHeaders } } : {}),
  };
}

/**
 * Returns false, without touching the queue, when the start track can't play:
 * the phone is offline and the track isn't saved.
 */
export async function playQueueFrom(
  items: PlayerTrack[],
  startId: string,
  context: PlayerAlbumContext,
): Promise<boolean> {
  const playable = playableNow(items);
  if (!playable.some((item) => item.id === startId)) return false;
  const run = lastPlay.then(() => replaceAndPlay(playable, startId, context));
  lastPlay = run.then(
    () => {},
    () => {},
  );
  await run;
  return true;
}

/**
 * With no connection only saved tracks can play, so the rest stay out of a new
 * queue rather than fail one at a time.
 */
function playableNow(items: PlayerTrack[]): PlayerTrack[] {
  return isOffline() ? items.filter((item) => canPlayNow(item.id)) : items;
}

/** A queued track that would only fail now: offline, and not saved. */
function isUnplayableNow(id: string): boolean {
  return !canPlayNow(id) && queueOrder.some((item) => item.id === id);
}

/**
 * A flow or playlist can hold many albums, and it starts playing before they've
 * all been looked up.
 *
 * Chained on the play queue so it can't land on a queue being rebuilt. A cover
 * for an album that's no longer queued does nothing.
 */
export function setQueuedAlbumCovers(
  covers: Map<string, string>,
): Promise<void> {
  const run = lastPlay.then(async () => {
    const updates = new Map<string, PlayerTrack>();
    for (const item of queueOrder) {
      const artwork =
        !item.artwork && item.albumMbid ? covers.get(item.albumMbid) : null;
      if (artwork) updates.set(item.id, { ...item, artwork });
    }
    if (updates.size === 0) return;

    mapQueuedTracks((item) => updates.get(item.id) ?? item);
    // The URLs are unchanged, so the engine treats this as a metadata edit: the
    // playing track carries on, and the lock screen picks up its new image.
    await TrackPlayer.updateTracks([...updates.values()].map(toEngineTrack));
  });
  lastPlay = run.catch(() => {});
  return run;
}

function mapQueuedTracks(update: (item: PlayerTrack) => PlayerTrack): void {
  queueOrder = queueOrder.map(update);
  originalOrder = originalOrder.map(update);
  if (currentEventTrack) currentEventTrack = update(currentEventTrack);
  refreshQueueSnapshot();
  if (displayedTrack) setDisplayedTrack(update(displayedTrack));
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
  // Offline, a restored or stopped track that isn't saved can't resume; the
  // next saved one plays instead.
  if (displayedTrack && isUnplayableNow(displayedTrack.id)) {
    skipUnplayable(displayedTrack.id, 1, true);
    return;
  }
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

/**
 * Append tracks to the end of the queue. Returns how many were queued.
 * Zero means nothing changed: no track was playable, or every playable one
 * was already queued. With nothing queued — or with only a preview clip in
 * the engine — the tracks start playing instead, as a fresh play.
 */
export function addToQueue(
  tracks: Track[],
  album: PlayerAlbumContext,
): Promise<number> {
  return editQueue(() => toPlayerTracks(tracks, album), album, "end");
}

/**
 * Insert tracks right after the current track, so they play next. Same
 * return value and empty-queue behavior as addToQueue.
 */
export function playNextInQueue(
  tracks: Track[],
  album: PlayerAlbumContext,
): Promise<number> {
  return editQueue(() => toPlayerTracks(tracks, album), album, "afterCurrent");
}

/**
 * addToQueue for tracks already in the player's shape, such as songs saved
 * on the phone, which have no library track to start from.
 */
export function addItemsToQueue(
  items: PlayerTrack[],
  album: PlayerAlbumContext,
): Promise<number> {
  return editQueue(() => items, album, "end");
}

/** playNextInQueue for tracks already in the player's shape. */
export function playItemsNext(
  items: PlayerTrack[],
  album: PlayerAlbumContext,
): Promise<number> {
  return editQueue(() => items, album, "afterCurrent");
}

function toPlayerTracks(
  tracks: Track[],
  album: PlayerAlbumContext,
): PlayerTrack[] {
  return tracks
    .map((track) => toPlayerTrack(track, album))
    .filter((item): item is PlayerTrack => item !== null);
}

/**
 * The one queue-mutation path behind addToQueue, playNextInQueue and their
 * item forms.
 * Chained on the play queue for the same reason plays are: an insert into a
 * playlist that a pending play is about to delete would land on the wrong
 * one.
 *
 * The engine mirrors the insert into live playback on both platforms.
 * queueAlbumContext stays the album the queue started from — each track
 * carries its own title, artist, album, and artwork, so the mini player and
 * the lock screen stay honest in a mixed-album queue. A queue that already
 * played out stays stopped; the next tap on "next" walks into the new
 * tracks.
 */
function editQueue(
  // Built when the edit runs, so the URLs carry the token of that moment.
  toItems: () => PlayerTrack[],
  album: PlayerAlbumContext,
  position: "afterCurrent" | "end",
): Promise<number> {
  const run = lastPlay.then(async (): Promise<number> => {
    const playable = playableNow(toItems());
    const items = withoutQueuedIds(playable, queueOrder);
    if (items.length === 0) return 0;

    // No library queue to extend: a clip queue has no album context, and it
    // must not survive behind real tracks.
    if (
      queueOrder.length === 0 ||
      !currentPlaylistId ||
      queueAlbumContext === null
    ) {
      return replaceAndPlay(items, items[0].id, album);
    }

    const currentId = displayedTrack?.id ?? null;
    const insertAt =
      position === "afterCurrent"
        ? insertIndexAfter(queueOrder, currentId)
        : queueOrder.length;
    const engineItems = items.map(toEngineTrack);
    if (insertAt === queueOrder.length) {
      await PlayerQueue.addTracksToPlaylist(currentPlaylistId, engineItems);
    } else {
      await PlayerQueue.addTracksToPlaylist(
        currentPlaylistId,
        engineItems,
        insertAt,
      );
    }
    queueOrder = insertedAt(queueOrder, items, insertAt);
    // Unshuffle keeps an insertion: it lands after the same track in the
    // original order, or at the end for a plain append.
    originalOrder =
      position === "afterCurrent"
        ? insertedAt(
            originalOrder,
            items,
            insertIndexAfter(originalOrder, currentId),
          )
        : [...originalOrder, ...items];
    refreshQueueSnapshot();
    return items.length;
  });
  lastPlay = run.then(
    () => {},
    () => {},
  );
  return run;
}

type Listener<T> = (value: T) => void;

/** Progress through the current track, for play-history recording. */
export type PlaybackProgress = {
  track: PlayerTrack;
  /** Seconds into the track. */
  position: number;
  /** Track length in seconds. Zero while the engine does not know it yet. */
  duration: number;
  /** The engine marked this report as following a seek. */
  seeked: boolean;
};

const trackStartedListeners = new Set<Listener<PlayerTrack>>();
const progressListeners = new Set<Listener<PlaybackProgress>>();
const playbackFailedListeners = new Set<() => void>();

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
/**
 * The last progress report, for spotting a pause that is really the end and a
 * repeat that has looped the track.
 */
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
  /** A rebuilt queue that was playing, so no tap on play will send the seek. */
  resumesPlaying?: boolean;
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
  updatePrefetchWindow();
}

function notifyModesChanged(): void {
  modesSnapshot = { shuffle: shuffleOn, repeat: repeatMode };
  modesChangedListeners.forEach((listener) => listener());
  persistQueue();
  updatePrefetchWindow();
}

/**
 * Name the tracks to fetch ahead: the next ones in the queue as it stands, not
 * the one playing. Repeat all wraps around to the top. A preview clip has
 * nothing to fetch.
 */
function updatePrefetchWindow(): void {
  const current = queueAlbumContext ? displayedTrack : null;
  const index = current
    ? queueOrder.findIndex((item) => item.id === current.id)
    : -1;
  const ahead = Math.min(
    getPlaybackSettings().prefetchAhead,
    queueOrder.length - 1,
  );
  const upcoming: PlayerTrack[] = [];
  for (let step = 1; index >= 0 && step <= ahead; step++) {
    const at = index + step;
    if (at >= queueOrder.length && repeatMode !== "all") break;
    upcoming.push(queueOrder[at % queueOrder.length]);
  }
  // Not while paused, or while a stream is still buffering its start.
  setPrefetchWindow(
    upcoming.flatMap((item) => toPrefetchTrack(item) ?? []),
    current?.id ?? null,
    playbackState === "playing",
  );
}

/** Saved tracks are on the phone already, and a clip has no file to fetch. */
function toPrefetchTrack(item: PlayerTrack): PrefetchTrack | null {
  if (!item.streamPath || savedFilePath(item.id) !== null) return null;
  return {
    id: item.id,
    streamPath: item.streamPath,
    audioFormat: item.audioFormat,
  };
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
 * built from it — and before any play, since it first clears the playlists
 * the engine kept. Returns false when nothing comes back.
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

  // Nothing is queued, so every engine playlist is a leftover: an earlier
  // process's, or one a sign-out could not delete. This runs at every launch
  // and sign-in, before any play, so a launch with nothing to restore still
  // clears them.
  await deleteEnginePlaylists();

  const saved = await readSavedQueue();
  if (!saved) return false;

  // A saved or fetched track plays from its file, so the server isn't asked
  // about it. Offline, the others still come back, passed over until the
  // connection does.
  await Promise.all([savedLibraryReady(), audioCacheReady(), networkKnown()]);
  const items = await restorableTracks(
    saved,
    (id) => localFilePath(id) !== null,
  );
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

/** How far short of its position a rebuilt track can start and still count. */
const RESUME_TOLERANCE_SECONDS = 2;

/** Returns the same object when the URL already holds the current token. */
function withCurrentToken(item: PlayerTrack): PlayerTrack {
  const url = item.streamPath ? buildAuthenticatedUrl(item.streamPath) : null;
  return url && url !== item.url ? { ...item, url } : item;
}

/**
 * Give the queue the current session's token after a new sign-in replaced the
 * old one, as when a restored backup drops every session. Does nothing when the
 * token hasn't changed.
 *
 * The playlist is rebuilt, not updated: the engine refuses a new URL for the
 * track it holds, and the old URL stops working with the old session. A track
 * that's playing carries on from its place after a short gap. One whose stream
 * has already failed comes back paused there.
 */
export function refreshQueueUrls(): Promise<void> {
  const run = lastPlay.then(async () => {
    if (!currentPlaylistId || !displayedTrack) return;
    if (queueOrder.every((item) => withCurrentToken(item) === item)) return;

    const wasPlaying =
      playbackState === "playing" || playbackState === "buffering";
    // A queue that played out starts its last track over, as the button does.
    const position = endedAtQueueEnd ? 0 : currentPosition();
    const duration = progressSnapshot.duration;
    const previousPlaylistId = currentPlaylistId;

    restoringQueue = true;
    try {
      pendingRestoreSeek = {
        trackId: displayedTrack.id,
        position,
        duration,
        resumesPlaying: wasPlaying,
      };
      // A track cut off near its end must not read as finished.
      lastProgress = null;
      setProgress(position, duration);
      mapQueuedTracks(withCurrentToken);

      // Cleared first, so a failure below can't leave the next play aiming at
      // a playlist that's gone.
      currentPlaylistId = null;
      await PlayerQueue.deletePlaylist(previousPlaylistId);
      const playlistId = await PlayerQueue.createPlaylist(PLAYLIST_NAME);
      currentPlaylistId = playlistId;
      await PlayerQueue.addTracksToPlaylist(
        playlistId,
        queueOrder.map(toEngineTrack),
      );
      await PlayerQueue.loadPlaylist(
        playlistId,
        queueOrder.findIndex((item) => item.id === displayedTrack?.id),
      );
      if (position > 0) {
        await TrackPlayer.seek(position);
      }
      if (wasPlaying) {
        await TrackPlayer.play();
      }
    } finally {
      restoringQueue = false;
    }
    persistQueue(position);
  });
  lastPlay = run.catch(() => {});
  return run;
}

/**
 * The URLs are unchanged, so the engine treats this as a metadata edit: the
 * playing track carries on, and every track after it loads with the new
 * headers.
 */
export function refreshQueueHeaders(): Promise<void> {
  const run = lastPlay.then(async () => {
    if (!currentPlaylistId || queueOrder.length === 0) return;
    await TrackPlayer.updateTracks(queueOrder.map(toEngineTrack));
  });
  lastPlay = run.catch(() => {});
  return run;
}

/**
 * Stop the player and forget the queue, in memory and in storage. Sign-out
 * calls this, so no part of one account's listening reaches the next.
 *
 * The state goes first, which stops any further save, and the delete runs at
 * the tail of the save chain — a write already queued cannot bring the record
 * back after it.
 */
export function forgetQueue(): Promise<void> {
  const run = lastPlay.then(async () => {
    queueOrder = [];
    originalOrder = [];
    queueAlbumContext = null;
    pendingRestoreSeek = null;
    endedAtQueueEnd = false;
    shuffleOn = false;
    repeatMode = "off";
    resetProgress();
    setDisplayedTrack(null);
    refreshQueueSnapshot();
    notifyModesChanged();

    // An engine that refuses to let go must not keep the record alive, and
    // must not fail the sign-out that asked for this. Every playlist goes,
    // not only the current one: the engine keeps earlier sessions' playlists
    // on disk, stream URLs and session tokens included, and a sign-out with
    // nothing played has no current one. A playlist that will not delete is
    // deleted by the next restore, at the next sign-in or launch.
    try {
      await TrackPlayer.pause();
    } catch {}
    await deleteEnginePlaylists();
    currentPlaylistId = null;

    lastSave = lastSave.then(clearSavedQueue).catch(() => {});
    await lastSave;
  });
  lastPlay = run.catch(() => {});
  return run;
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

/**
 * Whether a repeat just looped the track. Repeat-one loops without a track
 * change on either platform, so the position falling back to the start is the
 * only sign. A flagged seek is the listener's own unless it left the track's end,
 * because iOS can flag the loop as one. An unflagged fall need not start at the
 * end: a long track reports less often, and its reported length can be an estimate.
 */
function hasLooped(position: number, seeked: boolean): boolean {
  if (repeatMode !== "one" || lastProgress === null) return false;
  if (position >= TRACK_END_EPSILON_SECONDS) return false;
  return seeked ? isAtTrackEnd() : position < lastProgress.position;
}

function wireEngineEvents(): void {
  if (engineEventsWired) return;
  engineEventsWired = true;

  onNetworkChange((offline) => {
    if (offline) switchToLocalFiles();
  });
  onCachedFilesChange(followCachedFiles);
  // Read early, so an offline start knows which tracks are on the phone.
  void audioCacheReady();
  onPlaybackSettingsChange(updatePrefetchWindow);

  callbackManager.subscribeToTrackChange(
    function handleTrackChange(engineTrack): void {
      // Offline, a track that would only fail is passed over for the nearest
      // saved one, the way the player was going: "previous" moves one back.
      // A restored track is left where it is, paused, for a tap on play.
      if (
        pendingRestoreSeek?.trackId !== engineTrack.id &&
        isUnplayableNow(engineTrack.id)
      ) {
        const from = queueOrder.findIndex((i) => i.id === displayedTrack?.id);
        const to = queueOrder.findIndex((i) => i.id === engineTrack.id);
        skipUnplayable(
          engineTrack.id,
          from >= 0 && to === from - 1 ? -1 : 1,
          playbackState === "playing" || playbackState === "buffering",
        );
        return;
      }
      const started = asPlayerTrack(engineTrack);
      currentEventTrack = started;
      lastProgress = null;
      endedAtQueueEnd = false;
      // A new track starts at zero. Without this reset the scrubber keeps
      // the old track's position until the first tick arrives. A restored
      // track is the exception: it starts where it was saved, at a length
      // the engine has not read from the stream yet.
      const restored =
        pendingRestoreSeek?.trackId === started.id ? pendingRestoreSeek : null;
      if (!restored) pendingRestoreSeek = null;
      // Before the track, so the save this triggers pairs the new track with
      // its own position rather than with the last track's.
      setProgress(
        restored?.position ?? 0,
        started.duration || restored?.duration || 0,
      );
      setDisplayedTrack(started);
      markPlayed(started.id);
      // A queue rebuilt or restored partway through a track carries on the
      // same play rather than starting a new one.
      if (!restored?.position) {
        trackStartedListeners.forEach((listener) => listener(started));
      }
    },
  );
  callbackManager.subscribeToPlaybackProgressChange(
    function handleProgress(position, totalDuration, isManuallySeeked): void {
      const track = currentEventTrack;
      // During a rebuild, a report can only come from the stream being replaced.
      if (!track || restoringQueue) return;
      // The engine drops a seek sent before the track is ready, and a report
      // means it is. Skipped, so the scrubber never shows the track at zero.
      const resuming = pendingRestoreSeek?.resumesPlaying
        ? pendingRestoreSeek
        : null;
      if (resuming?.trackId === track.id) {
        pendingRestoreSeek = null;
        if (position < resuming.position - RESUME_TOLERANCE_SECONDS) {
          void TrackPlayer.seek(resuming.position);
          return;
        }
      }
      const seeked = isManuallySeeked === true;
      // Read before this report replaces the last position.
      const looped = hasLooped(position, seeked);
      const progress = { track, position, duration: totalDuration, seeked };
      lastProgress = progress;
      if (looped) {
        trackStartedListeners.forEach((listener) => listener(track));
      }
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
      updatePrefetchWindow();
      if (state === "stopped" && reason === "error") {
        // A streamed track can play out its buffer after the connection goes.
        if (currentEventTrack && isUnplayableNow(currentEventTrack.id)) {
          skipUnplayable(currentEventTrack.id, 1, true);
          return;
        }
        playbackFailedListeners.forEach((listener) => listener());
      }
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
      if (!currentEventTrack) return;
      currentEventTrack = null;
      lastProgress = null;
      endedAtQueueEnd = true;
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
    coverPath: null,
    trackMbid: null,
    artistMbid: null,
    albumMbid: null,
    favorite: null,
  };
}

/**
 * Hear about every time a track starts, whether the player moved onto it or a
 * repeat looped it. Returns unsubscribe.
 */
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

/** Hear about the engine giving up on a stream. Returns unsubscribe. */
export function onPlaybackFailed(listener: () => void): () => void {
  wireEngineEvents();
  playbackFailedListeners.add(listener);
  return function unsubscribe(): void {
    playbackFailedListeners.delete(listener);
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

/**
 * Move from a track that can't play offline to the nearest saved one in the
 * given direction, around the queue when it repeats. With none, the player
 * pauses where it is. `play` keeps a paused player paused. Chained on the
 * play queue, like a jump.
 */
function skipUnplayable(
  fromId: string,
  direction: 1 | -1,
  play: boolean,
): void {
  const run = lastPlay.then(async () => {
    const playlistId = currentPlaylistId;
    if (!playlistId) return;
    const target = nearestPlayable(fromId, direction);
    if (!target) {
      await TrackPlayer.pause();
      return;
    }
    await TrackPlayer.playSong(target.id, playlistId);
    if (play) await TrackPlayer.play();
  });
  lastPlay = run.catch(() => {});
}

/**
 * A track saved after its queue was built still streams. When the connection
 * goes, the queue's saved tracks move to their files. The engine keeps the
 * one it's playing as it is, and loads the rest from the new URLs.
 */
function switchToLocalFiles(): void {
  const run = lastPlay.then(async () => {
    if (!currentPlaylistId) return;
    const local = queueOrder.filter(
      (item) =>
        item.id !== displayedTrack?.id && localFilePath(item.id) !== null,
    );
    if (local.length === 0) return;
    await TrackPlayer.updateTracks(local.map(toEngineTrack));
  });
  lastPlay = run.catch(() => {});
}

/**
 * A queued track whose file was just fetched plays from it, and one whose file
 * was evicted or cleared goes back to its stream. The engine keeps the track
 * it's playing as it is.
 */
function followCachedFiles(trackIds: string[]): void {
  const changed = new Set(trackIds);
  const run = lastPlay.then(async () => {
    if (!currentPlaylistId || !queueAlbumContext) return;
    const items = queueOrder.filter(
      (item) => changed.has(item.id) && item.id !== displayedTrack?.id,
    );
    if (items.length === 0) return;
    await TrackPlayer.updateTracks(items.map(toEngineTrack));
  });
  lastPlay = run.catch(() => {});
}

function nearestPlayable(
  fromId: string,
  direction: 1 | -1,
): PlayerTrack | null {
  const count = queueOrder.length;
  const from = queueOrder.findIndex((item) => item.id === fromId);
  if (from < 0) return null;
  for (let step = 1; step < count; step++) {
    const index = from + step * direction;
    const wrapped = ((index % count) + count) % count;
    if (index !== wrapped && repeatMode !== "all") return null;
    const item = queueOrder[wrapped];
    if (!isUnplayableNow(item.id)) return item;
  }
  return null;
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
