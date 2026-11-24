import { fetch } from "expo/fetch";
import { buildAuthenticatedUrl, customHeadersFor } from "@/lib/api/client";
import { mapWithLimit } from "@/lib/map-with-limit";
import type { TrackFavorite } from "@/lib/api/library";
import type { RadioArtist, RadioSeed } from "@/lib/api/radio";
import type { RepeatMode } from "@/lib/player/player";
import type { RadioStation } from "@/lib/player/radio";
import type { PlayerAlbumContext, PlayerTrack } from "@/lib/player/track-item";
import { AppStorage } from "@/lib/storage";

/**
 * The queue as it survives a restart. Stream URLs are not written: the
 * session token inside them dies with the session, so each track keeps its
 * path and the restore builds the URL again.
 */
export type SavedTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string | null;
  streamPath: string;
  /** Written since the player loads the server's cover. */
  coverPath?: string | null;
  /**
   * Written since the play-history recorder needed them. A queue saved before
   * that reads back without them, and its tracks report plays without ids
   * rather than not being restored.
   */
  trackMbid?: string | null;
  artistMbid?: string | null;
  albumMbid?: string | null;
  /**
   * Written since the player offers favorites on flow and playlist tracks. A
   * library track saved before that kept only its `identityKey`, which still
   * reads back as its favorite.
   */
  favorite?: TrackFavorite | null;
  /** Written since the player opens the album page. */
  albumRef?: string | null;
  /** Written since the player shows the file's format and bitrate. */
  audioFormat?: string | null;
  bitrateKbps?: number | null;
  isPreview?: boolean;
  /** Absent on tracks that report their plays. */
  recordHistory?: boolean;
  /** Absent on tracks the listener queued. */
  autoplay?: boolean;
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
  /** A station keeps growing after a restore. Absent for any other queue. */
  station?: RadioStation | null;
};

const SAVED_QUEUE_VERSION = 1;

const REPEAT_MODES: readonly RepeatMode[] = ["off", "all", "one"];

const TRACK_FAVORITE_KINDS: readonly TrackFavorite["kind"][] = [
  "song",
  "flow-song",
  "shared-song",
];

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
    station: parseStation(parsed.station),
  };
}

function parseStation(raw: unknown): RadioStation | null {
  if (!isRecord(raw) || !isRecord(raw.seed)) return null;
  const seed: RadioSeed = {
    trackIds: asArray(raw.seed.trackIds).filter(isString),
    albumIds: asArray(raw.seed.albumIds).filter(isString),
    artists: asArray(raw.seed.artists).filter(isRecord).map(parseArtist),
  };
  return { seed, label: isString(raw.label) ? raw.label : "" };
}

function parseArtist(raw: Record<string, unknown>): RadioArtist {
  return {
    id: isString(raw.id) ? raw.id : null,
    mbid: isString(raw.mbid) ? raw.mbid : null,
    name: isString(raw.name) ? raw.name : null,
  };
}

const RETIRED_STREAM_ROUTE = "/library/canonical-stream/";
const STREAM_ROUTE = "/library/stream/";

/**
 * Aurral 3.0 renamed the Library stream route, kept its ids, and answers the
 * old name with a 404.
 */
export function upgradeStreamPath(path: string): string {
  return path.startsWith(RETIRED_STREAM_ROUTE)
    ? STREAM_ROUTE + path.slice(RETIRED_STREAM_ROUTE.length)
    : path;
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
    // A restored queue is written back with the new path.
    streamPath: upgradeStreamPath(raw.streamPath),
    coverPath: isString(raw.coverPath) ? raw.coverPath : null,
    trackMbid: isString(raw.trackMbid) ? raw.trackMbid : null,
    artistMbid: isString(raw.artistMbid) ? raw.artistMbid : null,
    albumMbid: isString(raw.albumMbid) ? raw.albumMbid : null,
    favorite:
      parseFavorite(raw.favorite) ??
      (isString(raw.identityKey)
        ? { kind: "song", key: raw.identityKey }
        : null),
    albumRef: isString(raw.albumRef) ? raw.albumRef : null,
    audioFormat: isString(raw.audioFormat) ? raw.audioFormat : null,
    bitrateKbps:
      typeof raw.bitrateKbps === "number" && raw.bitrateKbps > 0
        ? raw.bitrateKbps
        : null,
    isPreview: raw.isPreview === true,
    recordHistory: raw.recordHistory !== false,
    autoplay: raw.autoplay === true,
  };
}

function parseFavorite(raw: unknown): TrackFavorite | null {
  if (!isRecord(raw) || !isString(raw.key)) return null;
  const kind = TRACK_FAVORITE_KINDS.find((known) => known === raw.kind);
  return kind ? { kind, key: raw.key } : null;
}

function parseAlbum(raw: unknown): PlayerAlbumContext | null {
  if (!isRecord(raw)) return null;
  return {
    albumTitle: isString(raw.albumTitle) ? raw.albumTitle : "",
    artistName: isString(raw.artistName) ? raw.artistName : "",
    coverPath: isString(raw.coverPath) ? raw.coverPath : null,
    artworkUrl: isString(raw.artworkUrl) ? raw.artworkUrl : null,
    albumMbid: isString(raw.albumMbid) ? raw.albumMbid : null,
    artistMbid: isString(raw.artistMbid) ? raw.artistMbid : null,
    albumRef: isString(raw.albumRef) ? raw.albumRef : null,
  };
}

export function toSavedTrack(
  item: Omit<PlayerTrack, "url">,
): SavedTrack | null {
  if (!item.streamPath) return null;
  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    album: item.album,
    artwork: item.artwork,
    streamPath: item.streamPath,
    coverPath: item.coverPath,
    trackMbid: item.trackMbid,
    artistMbid: item.artistMbid,
    albumMbid: item.albumMbid,
    favorite: item.favorite,
    albumRef: item.albumRef,
    audioFormat: item.audioFormat,
    bitrateKbps: item.bitrateKbps,
    isPreview: item.isPreview,
    recordHistory: item.recordHistory,
    autoplay: item.autoplay,
  };
}

/**
 * The saved tracks that still play. A track drops when no URL can be built
 * for it, and when the server says the file is gone. A timeout or an
 * unreachable server keeps it: a cold start offline must not empty the queue.
 * A track saved on the phone plays from its file, so the server isn't asked.
 */
export async function restorableTracks(
  saved: SavedQueue,
  isSavedOnPhone: (id: string) => boolean = () => false,
): Promise<PlayerTrack[]> {
  const items = saved.items
    .map((item) => toPlayableTrack(item, saved.album))
    .filter(isPresent);
  const streams = await mapWithLimit(items, PROBE_CONCURRENCY, (item) =>
    isSavedOnPhone(item.id) ? Promise.resolve(true) : stillStreams(item.url),
  );
  return items.filter((_, index) => streams[index]);
}

/** A saved track as the player queues it, with a URL for the current session. */
export function toPlayableTrack(
  saved: SavedTrack,
  album: PlayerAlbumContext,
): PlayerTrack | null {
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
    coverPath: saved.coverPath ?? null,
    trackMbid: saved.trackMbid ?? null,
    favorite: saved.favorite ?? null,
    isPreview: saved.isPreview,
    recordHistory: saved.recordHistory,
    autoplay: saved.autoplay,
    artistMbid: saved.artistMbid ?? album.artistMbid,
    albumMbid: saved.albumMbid ?? album.albumMbid,
    albumRef: saved.albumRef ?? album.albumRef ?? null,
    audioFormat: saved.audioFormat ?? null,
    bitrateKbps: saved.bitrateKbps ?? null,
  };
}

const PROBE_TIMEOUT_MS = 5_000;
const PROBE_CONCURRENCY = 6;

async function stillStreams(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { ...customHeadersFor(url), Range: "bytes=0-0" },
      signal: controller.signal,
    });
    return response.status !== 404 && response.status !== 410;
  } catch {
    return true;
  } finally {
    clearTimeout(timeout);
  }
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
