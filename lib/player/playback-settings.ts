import { useSyncExternalStore } from "react";
import { AppStorage } from "@/lib/storage";

/**
 * How much audio pocket fetches ahead and keeps, from Settings › Playback and
 * Storage. Kept on the phone, for every account: they're about the phone's
 * data plan and space, not the server.
 */
export type PlaybackSettings = {
  /** Upcoming tracks fetched to disk while one plays. Zero turns it off. */
  prefetchAhead: number;
  /** The most tracks one play loads. Zero means no limit. */
  queueLimit: number;
  /** Bytes the fetched-ahead audio may take. Saves don't count. */
  cacheBytes: number;
  /** Fetching ahead and offline saves wait out cellular data. */
  wifiOnly: boolean;
};

export const PREFETCH_OPTIONS: readonly number[] = [0, 1, 3, 5, 10];
export const QUEUE_LIMIT_OPTIONS: readonly number[] = [0, 25, 50, 100, 200];
/** Decimal, as both platforms count storage and formatBytes shows it. */
export const CACHE_SIZE_OPTIONS: readonly number[] = [
  500_000_000, 1_000_000_000, 2_000_000_000, 5_000_000_000,
];

/** One track ahead and a gigabyte, so a short drop doesn't stop the music. */
export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  prefetchAhead: 1,
  queueLimit: 0,
  cacheBytes: 1_000_000_000,
  wifiOnly: false,
};

let settings: PlaybackSettings = DEFAULT_PLAYBACK_SETTINGS;
/** Changed before the stored record was read; those win over it. */
let edits: Partial<PlaybackSettings> = {};
let loaded: Promise<void> | null = null;
let lastWrite: Promise<void> = Promise.resolve();
const listeners = new Set<(next: PlaybackSettings) => void>();

function load(): Promise<void> {
  loaded ??= (async () => {
    const stored = parse(await AppStorage.getPlaybackSettings());
    apply({ ...stored, ...edits });
  })();
  return loaded;
}

function apply(next: PlaybackSettings): void {
  const changed = (Object.keys(next) as (keyof PlaybackSettings)[]).some(
    (key) => next[key] !== settings[key],
  );
  settings = next;
  if (changed) listeners.forEach((listener) => listener(settings));
}

/** Settles once the stored settings are read. Never rejects. */
export function playbackSettingsReady(): Promise<void> {
  return load().catch(() => {});
}

export function getPlaybackSettings(): PlaybackSettings {
  void load();
  return settings;
}

export function setPlaybackSettings(change: Partial<PlaybackSettings>): void {
  edits = { ...edits, ...change };
  apply({ ...settings, ...change });
  // Written once the stored record is read, so its other settings survive.
  lastWrite = lastWrite
    .then(() => load())
    .then(() => AppStorage.setPlaybackSettings(JSON.stringify(settings)))
    .catch(() => {});
}

/** Hear about any setting changing. Returns unsubscribe. */
export function onPlaybackSettingsChange(
  listener: (next: PlaybackSettings) => void,
): () => void {
  void load();
  listeners.add(listener);
  return function unsubscribe(): void {
    listeners.delete(listener);
  };
}

function subscribe(onStoreChange: () => void): () => void {
  return onPlaybackSettingsChange(onStoreChange);
}

const getSnapshot = () => settings;

export function usePlaybackSettings(): PlaybackSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** A value from an older or damaged record falls back to its default. */
function parse(raw: string | null): PlaybackSettings {
  if (!raw) return DEFAULT_PLAYBACK_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_PLAYBACK_SETTINGS;
    }
    const value = parsed as Record<string, unknown>;
    return {
      prefetchAhead: oneOf(
        value.prefetchAhead,
        PREFETCH_OPTIONS,
        DEFAULT_PLAYBACK_SETTINGS.prefetchAhead,
      ),
      queueLimit: oneOf(
        value.queueLimit,
        QUEUE_LIMIT_OPTIONS,
        DEFAULT_PLAYBACK_SETTINGS.queueLimit,
      ),
      cacheBytes: oneOf(
        value.cacheBytes,
        CACHE_SIZE_OPTIONS,
        DEFAULT_PLAYBACK_SETTINGS.cacheBytes,
      ),
      wifiOnly:
        typeof value.wifiOnly === "boolean"
          ? value.wifiOnly
          : DEFAULT_PLAYBACK_SETTINGS.wifiOnly,
    };
  } catch {
    return DEFAULT_PLAYBACK_SETTINGS;
  }
}

function oneOf(
  value: unknown,
  options: readonly number[],
  fallback: number,
): number {
  return typeof value === "number" && options.includes(value)
    ? value
    : fallback;
}
