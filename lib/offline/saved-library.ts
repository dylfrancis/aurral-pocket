import { useCallback, useMemo, useSyncExternalStore } from "react";
import { Directory, File, Paths } from "expo-file-system";
import { buildAuthenticatedUrl, customHeadersFor } from "@/lib/api/client";
import { getFlowStreamPath } from "@/lib/api/flow";
import { cachedFilePath, useIsTrackCached } from "@/lib/offline/audio-cache";
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
import { isOffline, useIsOffline } from "@/lib/offline/network";
import { toSavedTrack, type SavedTrack } from "@/lib/player/saved-queue";
import type { PlayerTrack } from "@/lib/player/track-item";
import { AppStorage } from "@/lib/storage";
import type { FlowJob, SharedPlaylist } from "@/lib/types/flow";
import type { Album, Track } from "@/lib/types/library";

/**
 * Albums, playlists and songs saved on the phone for offline play.
 *
 * Pocket downloads the files itself rather than through the audio engine's
 * download manager: that one sends no request headers, and on iOS it keeps an
 * error page as if it were the track. The engine plays a saved track because
 * the player hands it the file's path in place of the stream URL.
 *
 * Each saved item belongs to the account that saved it, and only that account
 * sees it. Sign-out keeps everything for the account's return. Change Server
 * and the 30-day reset delete it all, as they do the queue.
 *
 * No session token is written: a file keeps the stream path it came from, and
 * each download builds its URL from the token of the moment. A download that
 * outlives its session waits for the next one.
 */

export type SavedKind = "album" | "playlist" | "song";

/** What the album page was opened with, so the Offline screen can reopen it. */
export type SavedAlbumRoute = {
  title: string;
  artistName: string;
  artistMbid: string;
  albumMbid: string;
  coverUrl: string;
  lidarrAlbumId: string;
  canonicalAlbumId: string;
  artistId: string;
};

type ItemBase = {
  id: string;
  userId: number;
  savedAt: number;
};

/**
 * `id` is the album page's `ref`. `tracks` lets the page play offline, and
 * `album`, the library's record when the page had it, draws its card.
 */
export type SavedAlbum = ItemBase & {
  kind: "album";
  route: SavedAlbumRoute;
  tracks: Track[];
  album?: Album;
};

/** `jobs` are the playlist's finished tracks, which are the ones saved. */
export type SavedPlaylist = ItemBase & {
  kind: "playlist";
  playlist: SharedPlaylist;
  jobs: FlowJob[];
};

/** One song saved on its own, as the queue keeps a track. `id` is the track's. */
export type SavedSong = ItemBase & {
  kind: "song";
  track: SavedTrack;
};

export type SavedItem = SavedAlbum | SavedPlaylist | SavedSong;

export type TrackSave =
  | { kind: "none" }
  /** Saved on its own, and maybe in an album or playlist too. */
  | { kind: "own"; state: SaveState }
  /** On the phone only as part of a saved album or playlist. */
  | { kind: "held"; by: string };

/** One audio file, shared by every item that holds its track. */
type SavedFile = {
  streamPath: string;
  name: string;
  /** The server's size for the file. Zero when it didn't say. */
  expectedBytes: number;
  /** The size on disk. Null until the file is saved. */
  bytes: number | null;
  /** The server refused or lost the file. Try Again clears it. */
  failed: boolean;
};

export type SaveState = "saving" | "waiting" | "saved" | "incomplete";

export type SaveStatus = {
  item: SavedItem;
  state: SaveState;
  total: number;
  saved: number;
  failed: number;
  bytes: number;
};

type Snapshot = {
  items: SavedItem[];
  files: Record<string, SavedFile>;
  userId: number | null;
  blocked: "session" | "network" | null;
};

const RECORD_VERSION = 1;

let snapshot: Snapshot = { items: [], files: {}, userId: null, blocked: null };
/** The signed-in account's tracks with a file on disk. */
let savedTrackIds = new Set<string>();
let loaded: Promise<void> | null = null;
/** The account named last, applied once the record is read. */
let requestedUserId: number | null = null;
let lastWrite: Promise<void> = Promise.resolve();
let pumping = false;
let inFlight: {
  trackId: string;
  cancel: () => void;
  cancelled: boolean;
} | null = null;
const attempts = new Map<string, number>();
const listeners = new Set<() => void>();
const refusedListeners = new Set<() => void>();

function audioDirectory(): Directory {
  return new Directory(Paths.document, "saved-offline");
}

function fileFor(name: string): File {
  return new File(audioDirectory(), name);
}

function itemKey(kind: SavedKind, id: string): string {
  return `${kind}:${id}`;
}

function trackIdsOf(item: SavedItem): string[] {
  if (item.kind === "album") {
    return item.tracks
      .filter((track) => track.streamPath)
      .map((track) => track.id);
  }
  if (item.kind === "playlist") return item.jobs.map((job) => job.id);
  return [item.id];
}

function itemsOf(state: Snapshot): SavedItem[] {
  return state.userId === null
    ? []
    : state.items.filter((item) => item.userId === state.userId);
}

function commit(next: Partial<Snapshot>, { persist = true } = {}): void {
  snapshot = { ...snapshot, ...next };
  savedTrackIds = new Set(
    itemsOf(snapshot)
      .flatMap(trackIdsOf)
      .filter((id) => snapshot.files[id]?.bytes != null),
  );
  if (persist) write();
  listeners.forEach((listener) => listener());
}

function write(): void {
  const record = {
    version: RECORD_VERSION,
    items: snapshot.items,
    files: snapshot.files,
  };
  lastWrite = lastWrite
    .then(() => AppStorage.setSavedOffline(JSON.stringify(record)))
    .catch(() => {});
}

function load(): Promise<void> {
  loaded ??= (async () => {
    const raw = await AppStorage.getSavedOffline();
    const { items, files } = parseRecord(raw);
    // The account can be named before the record is read, and a restored
    // queue needs to know its saves the moment this settles.
    commit(
      { items, files: reconcile(files), userId: requestedUserId },
      { persist: false },
    );
    write();
    onDownloadHoldChange((hold) => {
      if (hold === null) {
        if (snapshot.blocked === "network") resumeSaving();
        return;
      }
      // A save going on Wi-Fi doesn't carry on over cellular. The next one
      // finds the hold and waits.
      if (hold === "wifi" && inFlight) cancelInFlight();
    });
  })();
  return loaded;
}

/**
 * A file the record calls saved but that's gone is saved again. A file left
 * by a download the app didn't see finish is kept when it's whole, and any
 * file the record doesn't know is deleted.
 */
function reconcile(
  files: Record<string, SavedFile>,
): Record<string, SavedFile> {
  const result: Record<string, SavedFile> = {};
  try {
    const directory = audioDirectory();
    directory.create({ intermediates: true, idempotent: true });
    const knownNames = new Set<string>();
    for (const [id, file] of Object.entries(files)) {
      knownNames.add(file.name);
      const onDisk = fileFor(file.name);
      if (file.bytes !== null) {
        result[id] = onDisk.exists ? file : { ...file, bytes: null };
      } else if (
        onDisk.exists &&
        file.expectedBytes > 0 &&
        onDisk.size === file.expectedBytes
      ) {
        result[id] = { ...file, bytes: onDisk.size };
      } else {
        deleteQuietly(onDisk);
        result[id] = file;
      }
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

export function savedLibraryReady(): Promise<void> {
  return load().catch(() => {});
}

/**
 * The account whose saves are shown and played. Sign-out passes null: the
 * saves stay on the phone, hidden, and a download in progress stops.
 */
export function setSavedLibraryUser(userId: number | null): void {
  requestedUserId = userId;
  void load().then(() => {
    if (requestedUserId !== userId) return;
    if (snapshot.userId !== userId) {
      commit({ userId, blocked: null }, { persist: false });
      const held = itemsOf(snapshot).flatMap(trackIdsOf);
      if (inFlight && !held.includes(inFlight.trackId)) cancelInFlight();
    }
    void saveWaitingFiles();
  });
}

/** Saving stopped on a refused session can go on: the token has changed. */
export function resumeSaving(): void {
  if (snapshot.blocked !== null) commit({ blocked: null }, { persist: false });
  void saveWaitingFiles();
}

/** Hear about the server refusing the session mid-save. Returns unsubscribe. */
export function onSaveRefused(listener: () => void): () => void {
  refusedListeners.add(listener);
  return function unsubscribe(): void {
    refusedListeners.delete(listener);
  };
}

/**
 * The path of a saved track's file, for the player to use in place of its
 * stream. Null unless the signed-in account saved the track and the file is
 * on disk.
 */
export function savedFilePath(trackId: string): string | null {
  if (!savedTrackIds.has(trackId)) return null;
  const file = snapshot.files[trackId];
  if (!file) return null;
  // The app's folder can move on an update, so the path is built fresh
  // rather than stored.
  return enginePath(fileFor(file.name));
}

/**
 * Online, any track can play; offline, only one the signed-in account saved
 * or one fetched ahead of the queue.
 */
export function canPlayNow(trackId: string): boolean {
  return (
    !isOffline() ||
    savedFilePath(trackId) !== null ||
    cachedFilePath(trackId) !== null
  );
}

export function saveAlbum(input: {
  ref: string;
  route: SavedAlbumRoute;
  tracks: Track[];
  album?: Album;
}): void {
  const files: Record<string, SavedFile> = {};
  for (const track of input.tracks) {
    if (!track.streamPath) continue;
    files[track.id] = {
      streamPath: track.streamPath,
      name: fileName(track.id, track.streamFormat, track.quality),
      expectedBytes: track.size > 0 ? track.size : 0,
      bytes: null,
      failed: false,
    };
  }
  add(
    (userId) => ({
      kind: "album",
      id: input.ref,
      userId,
      savedAt: Date.now(),
      route: input.route,
      tracks: input.tracks.filter((track) => track.streamPath),
      ...(input.album ? { album: input.album } : {}),
    }),
    files,
  );
}

/**
 * Only finished tracks are saved. A saved-for-later one streams a 30-second
 * clip from elsewhere, and the rest have no file yet.
 */
export function savePlaylist(input: {
  playlist: SharedPlaylist;
  jobs: FlowJob[];
}): void {
  const jobs = input.jobs.filter((job) => job.status === "done");
  const files: Record<string, SavedFile> = {};
  for (const job of jobs) {
    files[job.id] = {
      streamPath: getFlowStreamPath(job.id),
      name: fileName(job.id, job.streamFormat, job.qualityFormat),
      expectedBytes: 0,
      bytes: null,
      failed: false,
    };
  }
  add(
    (userId) => ({
      kind: "playlist",
      id: input.playlist.id,
      userId,
      savedAt: Date.now(),
      playlist: input.playlist,
      jobs,
    }),
    files,
  );
}

/** A queued track carries all a saved song needs. A preview clip has no file. */
export function saveSong(track: PlayerTrack): void {
  const saved = toSavedTrack(track);
  if (!saved) return;
  add(
    (userId) => ({
      kind: "song",
      id: saved.id,
      userId,
      savedAt: Date.now(),
      track: saved,
    }),
    {
      [saved.id]: {
        streamPath: saved.streamPath,
        name: fileName(saved.id, null, saved.audioFormat),
        expectedBytes: 0,
        bytes: null,
        failed: false,
      },
    },
  );
}

function add(
  build: (userId: number) => SavedItem,
  files: Record<string, SavedFile>,
): void {
  void load().then(() => {
    const userId = snapshot.userId;
    if (userId === null) return;
    const item = build(userId);
    const key = itemKey(item.kind, item.id);
    const items = [
      ...snapshot.items.filter(
        (other) =>
          other.userId !== userId || itemKey(other.kind, other.id) !== key,
      ),
      item,
    ];
    // A file already on the phone stays as it is. One that failed, or never
    // finished, starts over.
    const merged = { ...snapshot.files };
    for (const [id, file] of Object.entries(files)) {
      if (merged[id]?.bytes == null) merged[id] = file;
      attempts.delete(id);
    }
    commit({ items, files: dropUnheldFiles(items, merged) });
    void saveWaitingFiles();
  });
}

/** From disk and the record, as when an item is saved again with fewer tracks. */
function dropUnheldFiles(
  items: SavedItem[],
  files: Record<string, SavedFile>,
): Record<string, SavedFile> {
  const held = new Set(items.flatMap(trackIdsOf));
  const result: Record<string, SavedFile> = {};
  for (const [id, file] of Object.entries(files)) {
    if (held.has(id)) {
      result[id] = file;
      continue;
    }
    if (inFlight?.trackId === id) cancelInFlight();
    deleteQuietly(fileFor(file.name));
    attempts.delete(id);
  }
  return result;
}

/**
 * Give saved songs that have no cover the ones found for their albums, by
 * album MBID. A song keeps the cover's URL so it's known with no connection.
 */
export function rememberSongCovers(covers: Map<string, string>): void {
  if (covers.size === 0) return;
  void load().then(() => {
    let changed = false;
    const items = snapshot.items.map((item) => {
      if (item.kind !== "song" || item.track.artwork) return item;
      const cover = item.track.albumMbid
        ? covers.get(item.track.albumMbid)
        : undefined;
      if (!cover) return item;
      changed = true;
      return { ...item, track: { ...item.track, artwork: cover } };
    });
    if (changed) commit({ items });
  });
}

/** Delete a saved item. Files another saved item still holds stay. */
export function removeSaved(kind: SavedKind, id: string): Promise<void> {
  return load().then(() => {
    const key = itemKey(kind, id);
    const removed = itemsOf(snapshot).find(
      (item) => itemKey(item.kind, item.id) === key,
    );
    if (!removed) return;
    const items = snapshot.items.filter((item) => item !== removed);
    commit({ items, files: dropUnheldFiles(items, snapshot.files) });
  });
}

/** Try the files the server refused or lost once more. */
export function retrySaved(kind: SavedKind, id: string): void {
  void load().then(() => {
    const item = itemsOf(snapshot).find(
      (entry) => entry.kind === kind && entry.id === id,
    );
    if (!item) return;
    const files = { ...snapshot.files };
    for (const trackId of trackIdsOf(item)) {
      const file = files[trackId];
      if (file?.failed) files[trackId] = { ...file, failed: false };
      attempts.delete(trackId);
    }
    commit({ files, blocked: null });
    void saveWaitingFiles();
  });
}

/**
 * Delete every account's saves, files and record. Change Server and the
 * 30-day reset call this: the files belong to the server they came from.
 */
export function forgetSavedLibrary(): Promise<void> {
  return load()
    .catch(() => {})
    .then(() => {
      cancelInFlight();
      attempts.clear();
      try {
        const directory = audioDirectory();
        if (directory.exists) directory.delete();
      } catch {}
      commit({ items: [], files: {}, blocked: null }, { persist: false });
      lastWrite = lastWrite
        .then(() => AppStorage.deleteSavedOffline())
        .catch(() => {});
      return lastWrite;
    });
}

function cancelInFlight(): void {
  if (!inFlight) return;
  inFlight.cancelled = true;
  inFlight.cancel();
}

function nextToSave(): [string, SavedFile] | null {
  for (const item of itemsOf(snapshot)) {
    for (const id of trackIdsOf(item)) {
      const file = snapshot.files[id];
      if (file && file.bytes === null && !file.failed) return [id, file];
    }
  }
  return null;
}

/** One file at a time, in the order the items were saved. */
async function saveWaitingFiles(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    await load();
    await downloadHoldKnown();
    while (snapshot.blocked === null && snapshot.userId !== null) {
      const next = nextToSave();
      if (!next) break;
      await saveFile(...next);
    }
  } catch {
  } finally {
    pumping = false;
  }
}

async function saveFile(trackId: string, file: SavedFile): Promise<void> {
  if (downloadHold() !== null) {
    commit({ blocked: "network" }, { persist: false });
    return;
  }
  const url = buildAuthenticatedUrl(file.streamPath);
  if (!url) {
    commit({ blocked: "session" }, { persist: false });
    return;
  }

  const destination = fileFor(file.name);
  deleteQuietly(destination);
  const task = File.createDownloadTask(url, destination, {
    headers: customHeadersFor(url),
  });
  const download = { trackId, cancel: () => task.cancel(), cancelled: false };
  inFlight = download;
  try {
    const saved = await task.downloadAsync();
    if (download.cancelled || !saved) return;
    attempts.delete(trackId);
    setFile(trackId, { bytes: saved.size || file.expectedBytes });
  } catch (error) {
    // Android writes straight into the destination, so a failure can leave
    // part of the file behind.
    deleteQuietly(destination);
    if (download.cancelled) return;
    await afterFailure(trackId, httpStatusOf(error));
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
  const tries = (attempts.get(trackId) ?? 0) + 1;
  attempts.set(trackId, tries);

  if (status === null && isOffline()) {
    commit({ blocked: "network" }, { persist: false });
    return;
  }
  // A refused session stops every save until the token changes, then this
  // file goes again with a fresh URL.
  if (status === 401 && tries < MAX_ATTEMPTS) {
    commit({ blocked: "session" }, { persist: false });
    refusedListeners.forEach((listener) => listener());
    return;
  }
  // A lost connection or a busy server gets another go. An answer the server
  // means, such as a missing file, sticks until Try Again.
  const transient = status === null || status === 429 || status >= 500;
  if (transient && tries < MAX_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return;
  }
  setFile(trackId, { failed: true });
}

function setFile(trackId: string, change: Partial<SavedFile>): void {
  const file = snapshot.files[trackId];
  if (!file) return;
  commit({ files: { ...snapshot.files, [trackId]: { ...file, ...change } } });
}

function statusOf(state: Snapshot, item: SavedItem): SaveStatus {
  const ids = trackIdsOf(item);
  let saved = 0;
  let failed = 0;
  let bytes = 0;
  for (const id of ids) {
    const file = state.files[id];
    if (file?.bytes != null) {
      saved += 1;
      bytes += file.bytes;
    } else if (file?.failed) {
      failed += 1;
    }
  }
  const total = ids.length;
  const stage: SaveState =
    saved === total
      ? "saved"
      : saved + failed === total
        ? "incomplete"
        : state.blocked !== null
          ? "waiting"
          : "saving";
  return { item, state: stage, total, saved, failed, bytes };
}

function findStatus(
  state: Snapshot,
  kind: SavedKind,
  id: string,
): SaveStatus | null {
  const item = itemsOf(state).find(
    (entry) => entry.kind === kind && entry.id === id,
  );
  return item ? statusOf(state, item) : null;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  void load();
  return function unsubscribe(): void {
    listeners.delete(onStoreChange);
  };
}

const getSnapshot = () => snapshot;

function useSnapshot(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** An item's save, for the signed-in account. Null when it isn't saved. */
export function useSavedStatus(
  kind: SavedKind,
  id: string | null | undefined,
): SaveStatus | null {
  const state = useSnapshot();
  return useMemo(
    () => (id ? findStatus(state, kind, id) : null),
    [state, kind, id],
  );
}

/**
 * True once every file of an item is on the phone. Re-renders only when that
 * changes, so a grid of cards can each ask.
 */
export function useIsSaved(
  kind: SavedKind,
  id: string | null | undefined,
): boolean {
  const getSaved = () =>
    !!id && findStatus(snapshot, kind, id)?.state === "saved";
  return useSyncExternalStore(subscribe, getSaved, getSaved);
}

/** True when the signed-in account has this track's file on the phone. */
export function useIsTrackSaved(trackId: string): boolean {
  const getSaved = () => savedTrackIds.has(trackId);
  return useSyncExternalStore(subscribe, getSaved, getSaved);
}

/** canPlayNow as a hook: it follows the connection, the saves and the cache. */
export function useCanPlayNow(trackId: string): boolean {
  const offline = useIsOffline();
  const saved = useIsTrackSaved(trackId);
  const cached = useIsTrackCached(trackId);
  return !offline || saved || cached;
}

/**
 * The ids the signed-in account saved of one kind, saving or saved, for a
 * list's Saved Offline filter.
 */
export function useSavedIds(kind: SavedKind): ReadonlySet<string> {
  const state = useSnapshot();
  return useMemo(
    () =>
      new Set(
        itemsOf(state)
          .filter((item) => item.kind === kind)
          .map((item) => item.id),
      ),
    [state, kind],
  );
}

function trackSaveIn(state: Snapshot, trackId: string): TrackSave {
  const items = itemsOf(state);
  const own = items.find((item) => item.kind === "song" && item.id === trackId);
  if (own) return { kind: "own", state: statusOf(state, own).state };
  const holder = items.find(
    (item) => item.kind !== "song" && trackIdsOf(item).includes(trackId),
  );
  if (!holder) return { kind: "none" };
  if (holder.kind === "album") {
    return { kind: "held", by: holder.route.title };
  }
  return {
    kind: "held",
    by: holder.kind === "playlist" ? holder.playlist.name : "",
  };
}

/**
 * Looks up where a track stands. The lookup changes with every save, so a
 * menu built from it is built again.
 */
export function useTrackSaves(): (trackId: string) => TrackSave {
  const state = useSnapshot();
  return useCallback((trackId: string) => trackSaveIn(state, trackId), [state]);
}

/**
 * Bytes on the phone for the signed-in account. A file two saves hold counts
 * once.
 */
export function useSavedBytes(): number {
  const state = useSnapshot();
  return useMemo(() => {
    const ids = new Set(itemsOf(state).flatMap(trackIdsOf));
    let bytes = 0;
    for (const id of ids) bytes += state.files[id]?.bytes ?? 0;
    return bytes;
  }, [state]);
}

/** The signed-in account's saves, newest first. */
export function useSavedItems(): SaveStatus[] {
  const state = useSnapshot();
  return useMemo(
    () =>
      itemsOf(state)
        .map((item) => statusOf(state, item))
        .sort((a, b) => b.item.savedAt - a.item.savedAt),
    [state],
  );
}

function parseRecord(raw: string | null): {
  items: SavedItem[];
  files: Record<string, SavedFile>;
} {
  const empty = { items: [], files: {} };
  if (!raw) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== RECORD_VERSION) return empty;
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter(isSavedItem)
      : [];
    const files: Record<string, SavedFile> = {};
    if (isRecord(parsed.files)) {
      for (const [id, file] of Object.entries(parsed.files)) {
        if (isSavedFile(file)) files[id] = file;
      }
    }
    return { items, files };
  } catch {
    return empty;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSavedItem(value: unknown): value is SavedItem {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.userId !== "number") {
    return false;
  }
  if (value.kind === "album") {
    return isRecord(value.route) && Array.isArray(value.tracks);
  }
  if (value.kind === "playlist") {
    return isRecord(value.playlist) && Array.isArray(value.jobs);
  }
  if (value.kind === "song") {
    return isRecord(value.track) && typeof value.track.streamPath === "string";
  }
  return false;
}

function isSavedFile(value: unknown): value is SavedFile {
  return (
    isRecord(value) &&
    typeof value.streamPath === "string" &&
    typeof value.name === "string" &&
    (value.bytes === null || typeof value.bytes === "number")
  );
}
