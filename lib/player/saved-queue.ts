import { fetch } from "expo/fetch";
import { buildAuthenticatedUrl } from "@/lib/api/client";
import type { RepeatMode } from "@/lib/player/player";
import type { PlayerAlbumContext, PlayerTrack } from "@/lib/player/track-item";
import { AppStorage } from "@/lib/storage";

/**
 * The queue as it survives a restart.
 *
 * The player writes this as playback moves and reads it once at start. Stream
 * URLs are not written: the session token inside them dies with the session,
 * so each track keeps its path and the restore builds the URL again.
 */

/** One queued track, minus everything a restore can rebuild. */
type SavedTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string | null;
  streamPath: string;
};

export type SavedQueue = {
  /** The queue in play order — shuffled order included, as it was applied. */
  items: SavedTrack[];
  /** The album's own order, so unshuffle still works after a restore. */
  originalIds: string[];
  currentId: string | null;
  positionSeconds: number;
  album: PlayerAlbumContext;
  shuffle: boolean;
  repeat: RepeatMode;
};

/** Bumped when the shape changes. A record of any other version is dropped. */
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

/** The saved queue, or null when there is none and when the record is unusable. */
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
    positionSeconds:
      typeof parsed.positionSeconds === "number" && parsed.positionSeconds > 0
        ? parsed.positionSeconds
        : 0,
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

/** Turn a queued track into the record that outlives the session. */
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
 * The saved tracks that still play, in saved order, as playable tracks.
 *
 * Two things drop a track: the app cannot build a URL for it (no server
 * address or no session token), and the server answers that the file is gone.
 * Anything else — a timeout, no network, a server error — keeps the track,
 * because a cold start offline must not empty the queue.
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
    // The engine reads the real length from the stream.
    duration: 0,
    url,
    artwork: saved.artwork,
    streamPath: saved.streamPath,
  };
}

/** How long a track gets to answer before it keeps its place in the queue. */
const PROBE_TIMEOUT_MS = 5_000;
/** Probes in flight at once. An album's worth takes two or three rounds. */
const PROBE_CONCURRENCY = 6;

async function stillStreams(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // One byte is enough to learn whether the file is still there, and the
    // stream endpoint answers ranges.
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

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
