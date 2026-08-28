import { fetch } from "expo/fetch";
import { buildAuthenticatedUrl } from "@/lib/api/client";
import type { RepeatMode } from "@/lib/player/player";
import type { PlayerAlbumContext, PlayerTrack } from "@/lib/player/track-item";
import { AppStorage } from "@/lib/storage";

/**
 * The queue as it survives a restart. Stream URLs are not written: the
 * session token inside them dies with the session, so each track keeps its
 * path and the restore builds the URL again.
 */
type SavedTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string | null;
  streamPath: string;
};

export type SavedQueue = {
  /** The queue in play order, shuffle included. */
  items: SavedTrack[];
  /** The album's own order, so unshuffle still works after a restore. */
  originalIds: string[];
  currentId: string | null;
  positionSeconds: number;
  /** The engine reports zero until a track streams, so the length is saved. */
  durationSeconds: number;
  album: PlayerAlbumContext;
  shuffle: boolean;
  repeat: RepeatMode;
};

const SAVED_QUEUE_VERSION = 1;

const REPEAT_MODES: readonly RepeatMode[] = ["off", "all", "one"];

export async function saveQueue(queue: SavedQueue): Promise<void> {
  await AppStorage.setPlaybackQueue(
    JSON.stringify({ version: SAVED_QUEUE_VERSION, ...queue }),
  );
}

export async function clearSavedQueue(): Promise<void> {
  await AppStorage.deletePlaybackQueue();
}

export async function readSavedQueue(): Promise<SavedQueue | null> {
  const raw = await AppStorage.getPlaybackQueue();
  if (!raw) return null;
  try {
    return parseSavedQueue(JSON.parse(raw));
  } catch {
    return null;
  }
}

function parseSavedQueue(parsed: unknown): SavedQueue | null {
  if (!isRecord(parsed)) return null;
  if (parsed.version !== SAVED_QUEUE_VERSION) return null;

  const album = parseAlbum(parsed.album);
  if (!album) return null;

  const items = asArray(parsed.items).map(parseTrack).filter(isPresent);
  if (items.length === 0) return null;

  return {
    items,
    originalIds: asArray(parsed.originalIds).filter(isString),
    currentId: isString(parsed.currentId) ? parsed.currentId : null,
    positionSeconds: asSeconds(parsed.positionSeconds),
    durationSeconds: asSeconds(parsed.durationSeconds),
    album,
    shuffle: parsed.shuffle === true,
    repeat: REPEAT_MODES.includes(parsed.repeat as RepeatMode)
      ? (parsed.repeat as RepeatMode)
      : "off",
  };
}

function parseTrack(raw: unknown): SavedTrack | null {
  if (!isRecord(raw)) return null;
  if (!isString(raw.id) || !isString(raw.streamPath)) return null;
  return {
    id: raw.id,
    title: isString(raw.title) ? raw.title : "",
    artist: isString(raw.artist) ? raw.artist : "",
    album: isString(raw.album) ? raw.album : "",
    artwork: isString(raw.artwork) ? raw.artwork : null,
    streamPath: raw.streamPath,
  };
}

function parseAlbum(raw: unknown): PlayerAlbumContext | null {
  if (!isRecord(raw)) return null;
  return {
    albumTitle: isString(raw.albumTitle) ? raw.albumTitle : "",
    artistName: isString(raw.artistName) ? raw.artistName : "",
    artworkUrl: isString(raw.artworkUrl) ? raw.artworkUrl : null,
    artistMbid: isString(raw.artistMbid) ? raw.artistMbid : null,
  };
}

export function toSavedTrack(item: PlayerTrack): SavedTrack | null {
  if (!item.streamPath) return null;
  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    album: item.album,
    artwork: item.artwork,
    streamPath: item.streamPath,
  };
}

/**
 * The saved tracks that still play. A track drops when no URL can be built
 * for it, and when the server says the file is gone. A timeout or an
 * unreachable server keeps it: a cold start offline must not empty the queue.
 */
export async function restorableTracks(
  saved: SavedQueue,
): Promise<PlayerTrack[]> {
  const items = saved.items.map(toPlayableTrack).filter(isPresent);
  const streams = await mapWithLimit(items, PROBE_CONCURRENCY, (item) =>
    stillStreams(item.url),
  );
  return items.filter((_, index) => streams[index]);
}

function toPlayableTrack(saved: SavedTrack): PlayerTrack | null {
  const url = buildAuthenticatedUrl(saved.streamPath);
  if (!url) return null;
  return {
    id: saved.id,
    title: saved.title,
    artist: saved.artist,
    album: saved.album,
    duration: 0,
    url,
    artwork: saved.artwork,
    streamPath: saved.streamPath,
  };
}

const PROBE_TIMEOUT_MS = 5_000;
const PROBE_CONCURRENCY = 6;

async function stillStreams(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Range: "bytes=0-0" },
      signal: controller.signal,
    });
    return response.status !== 404 && response.status !== 410;
  } catch {
    return true;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += limit) {
    const batch = items.slice(start, start + limit);
    results.push(...(await Promise.all(batch.map(run))));
  }
  return results;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asSeconds(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
