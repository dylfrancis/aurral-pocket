import { useMemo, useSyncExternalStore } from "react";
import { Directory, File, Paths } from "expo-file-system";
import { buildAuthenticatedUrl, customHeadersFor } from "@/lib/api/client";
import { fetchTranscodedAudio } from "@/lib/api/transcoding";
import {
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  deleteQuietly,
  downloadHold,
  downloadHoldKnown,
  enginePath,
  fileName,
  httpStatusOf,
  onDownloadHoldChange,
} from "@/lib/offline/download";
import { isOffline } from "@/lib/offline/network";
import {
  getPlaybackSettings,
  onPlaybackSettingsChange,
} from "@/lib/player/playback-settings";
import { AppStorage } from "@/lib/storage";
import {
  transcodeKey,
  TRANSCODE_OUTPUT,
  type TranscodeRequest,
} from "@/lib/player/transcoding";

/**
 * Tracks fetched to the phone ahead of the queue, so a drop in signal doesn't
 * stop the music. The player names what it wants, in the order it will play,
 * and plays a fetched track from its file.
 *
 * The files take no more than the cache size in Settings. Past it, the least
 * recently played go first, but never the one playing.
 * Saved albums live apart, in lib/offline/saved-library.ts, and don't count.
 *
 * Like offline saves, no session token is written: each download builds its
 * URL from the token of the moment, and a refused one waits for the next. The
 * cache goes with the queue at sign-out, Change Server and the 30-day reset.
 */

export type PrefetchTrack = {
  id: string;
  streamPath: string;
  /** As the player names it, such as "FLAC", for the file's extension. */
  audioFormat?: string | null;
  transcode?: TranscodeRequest;
};

type CachedFile = {
  name: string;
  bytes: number;
  /** When the track last played, or was fetched, for evicting the oldest. */
  usedAt: number;
  /** Absent on the server's original stream. */
  transcode?: TranscodeRequest;
};

type Snapshot = { files: Record<string, CachedFile> };

const RECORD_VERSION = 1;

let snapshot: Snapshot = { files: {} };
let loaded: Promise<void> | null = null;
let lastWrite: Promise<void> = Promise.resolve();
/** In play order. */
let wanted: PrefetchTrack[] = [];
/** Its file is never evicted. */
let playingId: string | null = null;
let isPlaying = false;
/** Set by Clear Cache, so the space it freed stays free until another track plays. */
let waitForNextTrack = false;
let pumping = false;
/** The server refused the session. Waits for a new token. */
let refused = false;
let inFlight: {
  trackId: string;
  quality?: string;
  cancel: () => void;
  cancelled: boolean;
} | null = null;
const transcodes = new Map<
  string,
  { controller: AbortController; result: Promise<string | null> }
>();
const attempts = new Map<string, number>();
/** The server refused or lost these files. They stream instead. */
const failed = new Set<string>();
/**
 * A lost connection or busy server outlasted the retries. Tried again when
 * the player wants something else.
 */
const gaveUp = new Set<string>();
/**
 * Sizes learned from a fetch, so a track that wouldn't fit isn't fetched
 * again only to go back out.
 */
const knownBytes = new Map<string, number>();
const listeners = new Set<() => void>();
const changeListeners = new Set<(trackIds: string[]) => void>();
const refusedListeners = new Set<() => void>();

function cacheDirectory(): Directory {
  return new Directory(Paths.cache, "prefetch");
}

function fileFor(name: string): File {
  return new File(cacheDirectory(), name);
}

function commit(next: Snapshot, { persist = true } = {}): void {
  snapshot = next;
  if (persist) write();
  listeners.forEach((listener) => listener());
}

function write(): void {
  const record = JSON.stringify({
    version: RECORD_VERSION,
    files: snapshot.files,
  });
  lastWrite = lastWrite
    .then(() => AppStorage.setAudioCache(record))
    .catch(() => {});
}

/** Tell the player which tracks gained or lost their file. */
function announce(trackIds: string[]): void {
  if (trackIds.length === 0) return;
  changeListeners.forEach((listener) => listener(trackIds));
}

function load(): Promise<void> {
  loaded ??= (async () => {
    const files = reconcile(parseRecord(await AppStorage.getAudioCache()));
    commit({ files }, { persist: false });
    write();
    // A queue built before the record was read streams these.
    announce(Object.keys(files));
    onDownloadHoldChange((hold) => {
      if (hold === null) {
        void fetchWanted();
        return;
      }
      // A fetch going on Wi-Fi doesn't carry on over cellular.
      if (hold === "wifi") cancelInFlight();
    });
    onPlaybackSettingsChange(() => {
      fitInCap();
      void fetchWanted();
    });
  })();
  return loaded;
}

/**
 * A file the record names but that's gone is forgotten, as the system may
 * clear a cache. A file the record doesn't know, as from a fetch the app
 * didn't see finish, is deleted.
 */
function reconcile(
  files: Record<string, CachedFile>,
): Record<string, CachedFile> {
  const result: Record<string, CachedFile> = {};
  try {
    const directory = cacheDirectory();
    directory.create({ intermediates: true, idempotent: true });
    const knownNames = new Set<string>();
    for (const [id, file] of Object.entries(files)) {
      if (!fileFor(file.name).exists) continue;
      result[id] = file;
      knownNames.add(file.name);
    }
    for (const entry of directory.list()) {
      if (entry instanceof File && !knownNames.has(entry.name)) {
        deleteQuietly(entry);
      }
    }
  } catch {
    return files;
  }
  return result;
}

export function audioCacheReady(): Promise<void> {
  return load().catch(() => {});
}

/** The path of a fetched track's file, for the player to use in place of its stream. */
export function cachedFilePath(
  trackId: string,
  quality?: TranscodeRequest,
): string | null {
  const file = snapshot.files[trackId];
  return file && (isOffline() || matchesQuality(file, quality))
    ? enginePath(fileFor(file.name))
    : null;
}

export function cachedTranscode(
  trackId: string,
  url: string,
): TranscodeRequest | undefined {
  const file = snapshot.files[trackId];
  return file?.transcode && url === enginePath(fileFor(file.name))
    ? file.transcode
    : undefined;
}

export function cancelTranscodes(): void {
  transcodes.forEach(({ controller }) => controller.abort());
}

function matchesQuality(file: CachedFile, quality?: TranscodeRequest): boolean {
  // An original already on the phone costs no bandwidth to play.
  return file.transcode
    ? file.transcode.kbps === quality?.kbps &&
        file.transcode.format === quality.format
    : !quality?.required;
}

/** Wait for a complete file so the native player doesn't need server byte ranges. */
export function cacheTranscodedTrack(
  id: string,
  streamPath: string,
  quality: TranscodeRequest,
): Promise<string | null> {
  const cached = cachedFilePath(id, quality);
  if (cached || isOffline()) return Promise.resolve(cached);
  const key = `${id}:${transcodeKey(quality)}`;
  const pending = transcodes.get(key);
  if (pending) return pending.result;

  const controller = new AbortController();
  const result = writeTranscodedTrack(id, streamPath, quality, controller)
    .catch(() => null)
    .finally(() => transcodes.delete(key));
  transcodes.set(key, { controller, result });
  return result;
}

async function writeTranscodedTrack(
  id: string,
  streamPath: string,
  quality: TranscodeRequest,
  controller: AbortController,
): Promise<string | null> {
  const { signal } = controller;
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const name = fileName(
    `${id}_transcoded_${transcodeKey(quality)}`,
    TRANSCODE_OUTPUT[quality.format].extension,
    null,
  );
  const destination = fileFor(name);
  let complete = false;
  try {
    await load();
    const body = await fetchTranscodedAudio(streamPath, quality, signal);
    if (!body) return null;
    const reader = body.getReader();
    try {
      if (signal.aborted) return null;
      cacheDirectory().create({ intermediates: true, idempotent: true });
      destination.create({ overwrite: true });
      const handle = destination.open();
      let bytes = 0;
      let ended = false;
      try {
        while (!signal.aborted) {
          const { value, done } = await reader.read();
          if (done) {
            ended = true;
            break;
          }
          bytes += value.byteLength;
          if (bytes > getPlaybackSettings().cacheBytes) return null;
          await handle.writeBytes(value);
        }
      } finally {
        handle.close();
      }
      complete = ended && !signal.aborted && bytes > 0;
      if (!complete) return null;
      storeFile(id, { name, bytes, usedAt: Date.now(), transcode: quality });
      return cachedFilePath(id, quality);
    } finally {
      if (!complete) await reader.cancel().catch(() => {});
    }
  } finally {
    clearTimeout(timeout);
    if (!complete) deleteQuietly(destination);
  }
}

function storeFile(id: string, file: CachedFile): void {
  const previous = snapshot.files[id];
  if (previous && previous.name !== file.name) {
    deleteQuietly(fileFor(previous.name));
  }
  commit({ files: { ...snapshot.files, [id]: file } });
  fitInCap();
  if (snapshot.files[id]) announce([id]);
}

/**
 * The tracks the player wants on the phone, in play order, and the one it's
 * on. They're fetched one at a time while `playing` is true: a paused player
 * starts no fetch, and one under way finishes.
 */
export function setPrefetchWindow(
  upcoming: PrefetchTrack[],
  current: string | null,
  playing: boolean,
): void {
  const sameTracks =
    current === playingId &&
    upcoming.length === wanted.length &&
    upcoming.every(
      (track, index) =>
        track.id === wanted[index].id &&
        track.transcode?.kbps === wanted[index].transcode?.kbps &&
        track.transcode?.format === wanted[index].transcode?.format,
    );
  if (sameTracks && playing === isPlaying) return;
  isPlaying = playing;
  if (sameTracks) {
    if (isPlaying) void fetchWanted();
    return;
  }
  wanted = upcoming;
  if (current !== playingId) waitForNextTrack = false;
  playingId = current;
  gaveUp.clear();
  if (
    inFlight &&
    current !== inFlight.trackId &&
    !upcoming.some(
      (track) =>
        track.id === inFlight?.trackId &&
        (track.transcode ? transcodeKey(track.transcode) : undefined) ===
          inFlight.quality,
    )
  ) {
    cancelInFlight();
  }
  void fetchWanted();
}

/** Moves the track to the back of the eviction order. */
export function markPlayed(trackId: string): void {
  const file = snapshot.files[trackId];
  if (!file) return;
  commit({
    files: { ...snapshot.files, [trackId]: { ...file, usedAt: Date.now() } },
  });
}

/** Fetching stopped on a refused session can go on: the token has changed. */
export function resumePrefetch(): void {
  refused = false;
  void fetchWanted();
}

/** Hear about the server refusing the session mid-fetch. Returns unsubscribe. */
export function onPrefetchRefused(listener: () => void): () => void {
  refusedListeners.add(listener);
  return function unsubscribe(): void {
    refusedListeners.delete(listener);
  };
}

/**
 * Hear which tracks gained or lost their file, so queued ones can switch
 * between the file and the stream. Returns unsubscribe.
 */
export function onCachedFilesChange(
  listener: (trackIds: string[]) => void,
): () => void {
  changeListeners.add(listener);
  return function unsubscribe(): void {
    changeListeners.delete(listener);
  };
}

/**
 * Delete every fetched file but the one playing: deleting that would break a
 * seek. The tracks up next go back to their streams, and fetching starts again
 * with the next track. Saves are never touched: they live in another folder.
 */
export function clearAudioCache(): Promise<void> {
  return load().then(() => {
    cancelInFlight();
    cancelTranscodes();
    waitForNextTrack = true;
    const files: Record<string, CachedFile> = {};
    const removed: string[] = [];
    for (const [id, file] of Object.entries(snapshot.files)) {
      if (id === playingId) {
        files[id] = file;
        continue;
      }
      deleteQuietly(fileFor(file.name));
      removed.push(id);
    }
    commit({ files });
    announce(removed);
  });
}

/** Delete every fetched file and the record. Sign-out and the resets call this. */
export function forgetAudioCache(): Promise<void> {
  return load()
    .catch(() => {})
    .then(() => {
      cancelInFlight();
      cancelTranscodes();
      wanted = [];
      playingId = null;
      isPlaying = false;
      waitForNextTrack = false;
      refused = false;
      attempts.clear();
      failed.clear();
      gaveUp.clear();
      knownBytes.clear();
      const removed = Object.keys(snapshot.files);
      try {
        const directory = cacheDirectory();
        if (directory.exists) directory.delete();
      } catch {}
      commit({ files: {} }, { persist: false });
      announce(removed);
      lastWrite = lastWrite
        .then(() => AppStorage.deleteAudioCache())
        .catch(() => {});
      return lastWrite;
    });
}

function totalBytes(files: Record<string, CachedFile>): number {
  return Object.values(files).reduce((sum, file) => sum + file.bytes, 0);
}

/**
 * Bring the cache under its size. The least recently played go first; then,
 * if what the player wants is too much on its own, the furthest ahead of it.
 * The track playing never goes: deleting it would break a seek.
 */
function fitInCap(): void {
  const cap = getPlaybackSettings().cacheBytes;
  let total = totalBytes(snapshot.files);
  if (total <= cap) return;

  const wantedOrder = new Map(wanted.map((track, index) => [track.id, index]));
  const evictable = Object.entries(snapshot.files)
    .filter(([id]) => id !== playingId)
    .sort(([idA, a], [idB, b]) => {
      const orderA = wantedOrder.get(idA);
      const orderB = wantedOrder.get(idB);
      if (orderA === undefined && orderB === undefined) {
        return a.usedAt - b.usedAt;
      }
      if (orderA === undefined) return -1;
      if (orderB === undefined) return 1;
      return orderB - orderA;
    });

  const files = { ...snapshot.files };
  const removed: string[] = [];
  for (const [id, file] of evictable) {
    if (total <= cap) break;
    deleteQuietly(fileFor(file.name));
    delete files[id];
    total -= file.bytes;
    removed.push(id);
  }
  if (removed.length === 0) return;
  commit({ files });
  announce(removed);
}

/**
 * The first wanted track that's neither on the phone nor refused. Null when
 * there's none, or when the next one wouldn't fit beside the ones before it.
 */
function nextToFetch(): PrefetchTrack | null {
  const cap = getPlaybackSettings().cacheBytes;
  const playingFile =
    playingId && !wanted.some((track) => track.id === playingId)
      ? snapshot.files[playingId]
      : undefined;
  // It's never evicted, so it takes room from the ones ahead.
  let held = playingFile?.bytes ?? 0;
  for (const track of wanted) {
    const file = snapshot.files[track.id];
    if (file && matchesQuality(file, track.transcode)) {
      held += file.bytes;
      continue;
    }
    if (failed.has(track.id) || gaveUp.has(track.id)) continue;
    if (held + (knownBytes.get(track.id) ?? 0) > cap) return null;
    return track;
  }
  return null;
}

/** One file at a time, in the order the player will want them. */
async function fetchWanted(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    await load();
    await downloadHoldKnown();
    while (
      isPlaying &&
      !waitForNextTrack &&
      !refused &&
      downloadHold() === null
    ) {
      const next = nextToFetch();
      if (!next) break;
      await fetchFile(next);
    }
  } catch {
  } finally {
    pumping = false;
  }
}

async function fetchFile(track: PrefetchTrack): Promise<void> {
  if (track.transcode) {
    const result = cacheTranscodedTrack(
      track.id,
      track.streamPath,
      track.transcode,
    );
    const job = transcodes.get(`${track.id}:${transcodeKey(track.transcode)}`);
    const download = {
      trackId: track.id,
      quality: transcodeKey(track.transcode),
      cancel: () => job?.controller.abort(),
      cancelled: false,
    };
    inFlight = download;
    try {
      if (!(await result) && !download.cancelled) gaveUp.add(track.id);
    } finally {
      if (inFlight === download) inFlight = null;
    }
    return;
  }
  const url = buildAuthenticatedUrl(track.streamPath);
  if (!url) {
    refused = true;
    return;
  }

  const name = fileName(track.id, null, track.audioFormat);
  const destination = fileFor(name);
  try {
    // Gone after a forget, or if the system cleared the cache.
    cacheDirectory().create({ intermediates: true, idempotent: true });
  } catch {}
  deleteQuietly(destination);
  // A background session started while the phone is locked can wait on the
  // system. Playing audio keeps the app running, so this one goes now.
  const task = File.createDownloadTask(url, destination, {
    headers: customHeadersFor(url),
    sessionType: "foreground",
  });
  const download = {
    trackId: track.id,
    cancel: () => task.cancel(),
    cancelled: false,
  };
  inFlight = download;
  try {
    const downloaded = await task.downloadAsync();
    if (download.cancelled || !downloaded) {
      deleteQuietly(destination);
      return;
    }
    attempts.delete(track.id);
    const bytes = downloaded.size;
    knownBytes.set(track.id, bytes);
    storeFile(track.id, { name, bytes, usedAt: Date.now() });
  } catch (error) {
    // Android writes straight into the destination, so a failure can leave
    // part of the file behind.
    deleteQuietly(destination);
    if (download.cancelled) return;
    await afterFailure(track.id, httpStatusOf(error));
  } finally {
    if (inFlight === download) inFlight = null;
    try {
      task.release();
    } catch {}
  }
}

async function afterFailure(
  trackId: string,
  status: number | null,
): Promise<void> {
  // The loop finds the hold and stops; the hold's end starts it again. A
  // dropped connection doesn't use up a try.
  if (status === null && downloadHold() !== null) return;
  const tries = (attempts.get(trackId) ?? 0) + 1;
  attempts.set(trackId, tries);
  if (status === 401 && tries < MAX_ATTEMPTS) {
    refused = true;
    refusedListeners.forEach((listener) => listener());
    return;
  }
  const transient = status === null || status === 429 || status >= 500;
  if (!transient && status !== 401) {
    failed.add(trackId);
    return;
  }
  if (tries < MAX_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return;
  }
  attempts.delete(trackId);
  gaveUp.add(trackId);
}

function cancelInFlight(): void {
  if (!inFlight) return;
  inFlight.cancelled = true;
  inFlight.cancel();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  void load();
  return function unsubscribe(): void {
    listeners.delete(onStoreChange);
  };
}

const getSnapshot = () => snapshot;

/** Bytes the fetched-ahead audio takes on the phone. */
export function useCachedBytes(): number {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => totalBytes(state.files), [state]);
}

/** True while a track's fetched file is on the phone. */
export function useIsTrackCached(trackId: string): boolean {
  const getCached = () => trackId in snapshot.files;
  return useSyncExternalStore(subscribe, getCached, getCached);
}

function parseRecord(raw: string | null): Record<string, CachedFile> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== RECORD_VERSION) return {};
    const files: Record<string, CachedFile> = {};
    if (isRecord(parsed.files)) {
      for (const [id, file] of Object.entries(parsed.files)) {
        if (isCachedFile(file)) files[id] = file;
      }
    }
    return files;
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCachedFile(value: unknown): value is CachedFile {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.bytes === "number" &&
    typeof value.usedAt === "number" &&
    (value.transcode === undefined ||
      (isRecord(value.transcode) &&
        typeof value.transcode.format === "string" &&
        Object.hasOwn(TRANSCODE_OUTPUT, value.transcode.format) &&
        typeof value.transcode.kbps === "number"))
  );
}
