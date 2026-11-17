import Constants from "expo-constants";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { IS_IOS } from "@/constants/platform";
import {
  isLiveSocketConnected,
  subscribeToLiveChannel,
  subscribeToLiveStatus,
} from "@/lib/api/live-socket";
import {
  getPlayQueue,
  savePlayQueue,
  type PlayQueue,
  type PlayQueueSave,
} from "@/lib/api/play-queue";
import { isOffline, onNetworkChange } from "@/lib/offline/network";
import {
  isPlaybackActive,
  listenerPlayCount,
  onQueueSaved,
  takeOverQueue,
  type QueueElsewhere,
  type QueueSaved,
} from "@/lib/player/player";
import type { SavedQueue } from "@/lib/player/saved-queue";
import {
  queueTrackToPlayerTrack,
  type PlayerTrack,
} from "@/lib/player/track-item";
import { AppStorage, SecureStorage } from "@/lib/storage";

/*
 * Keeps the account's play queue on Aurral in step with this phone's, so the
 * web player and Subsonic clients can pick up where pocket left off, and the
 * reverse. The timings and the window follow the web player's.
 */

/** While playing, a save that only moves the position waits this long. */
const SAVE_WHILE_PLAYING_MS = 30_000;
/** A position this close to the last one sent isn't worth sending. */
const POSITION_MOVE_MS = 1_000;
/** The server keeps up to 1000, and the web sends at most this many. */
const MAX_TRACKS = 200;
/** Of those, how many come before the current track. */
const HISTORY_KEPT = 20;

const DEVICE_PREFIX = "Aurral Pocket";

type RemoteSave = Omit<PlayQueueSave, "device">;

type Sync = {
  /** The name this phone saves under. Read from storage before any request. */
  device: string;
  /** The newest server save this phone has made, taken or turned down. */
  seen: number;
  /** A change the server hasn't had yet, from offline or a failed save. */
  pending: boolean;
  ready: Promise<void>;
  /** The queue as last saved here. */
  latest: SavedQueue | null;
  sent: { key: string; positionMs: number; at: number } | null;
  saving: Promise<void>;
  checking: boolean;
  checkAgain: boolean;
  onTakenOver: (items: PlayerTrack[]) => void;
  stops: (() => void)[];
};

/**
 * The queue another device saved after this phone's last save, which the
 * listener can pick up here. Aurral keeps only the account's latest queue, so
 * there's at most one.
 */
export type OtherDevice = {
  /** The device or client that saved it, as people know it. */
  name: string;
  track: PlayerTrack;
  positionSeconds: number;
  /** When it was saved, in the server's epoch ms. */
  savedAt: number;
};

type Listed = OtherDevice & { queue: QueueElsewhere };

let sync: Sync | null = null;
let listed: Listed | null = null;
/** The queue being picked up, so a second tap during the load does nothing. */
let pickingUp: Listed | null = null;
/** Storage writes in order, so a forget can't be undone by a write behind it. */
let writes: Promise<void> = Promise.resolve();
const listedListeners = new Set<() => void>();

/**
 * Starts keeping the queue in step for the signed-in account. Returns a
 * function that stops it. `onTakenOver` hears the tracks of each queue taken
 * from another device.
 */
export function startQueueSync({
  onTakenOver = () => {},
}: { onTakenOver?: (items: PlayerTrack[]) => void } = {}): () => void {
  if (sync) end(sync);
  const s: Sync = {
    device: "",
    seen: 0,
    pending: false,
    ready: Promise.resolve(),
    latest: null,
    sent: null,
    saving: Promise.resolve(),
    checking: false,
    checkAgain: false,
    onTakenOver,
    stops: [],
  };
  sync = s;
  s.ready = Promise.all([readDevice(), readRecord()]).then(
    ([device, record]) => {
      s.device = device;
      s.seen = record.seen;
      s.pending = record.pending;
    },
  );

  s.stops = [
    onQueueSaved((saved) => heardSave(s, saved)),
    subscribeToLiveChannel("play-queue", ["play_queue_changed"], (message) => {
      if (message.changedBy !== s.device) void check(s);
    }),
    // Changes sent while the socket was down are lost.
    subscribeToLiveStatus(() => {
      if (isLiveSocketConnected()) void check(s);
    }),
    onNetworkChange((offline) => {
      if (!offline) void check(s);
    }),
    onForeground(() => void check(s)),
  ];
  void check(s);

  return function stop(): void {
    if (sync === s) end(s);
  };
}

/**
 * Forget how the queue stood against the server's copy. Sign-out calls this.
 * The server's copy stays, for the account's other devices.
 */
export function forgetQueueSync(): Promise<void> {
  if (sync) end(sync);
  writes = writes.then(() => AppStorage.deleteQueueSync()).catch(() => {});
  return writes;
}

/**
 * Play the other device's queue here, from where it left off. It stays listed
 * until the queue has loaded, so a failed load can be tried again. Resolves
 * once it plays.
 */
export async function pickUpQueue(): Promise<void> {
  const s = sync;
  const entry = listed;
  if (!s || !entry || pickingUp === entry) return;
  pickingUp = entry;
  try {
    const result = await takeOverQueue(entry.queue, { play: true });
    if (sync !== s) return;
    if (listed === entry) setListed(null);
    s.seen = Math.max(s.seen, entry.savedAt);
    s.pending = false;
    writeRecord(s);
    if (result === "loaded") s.onTakenOver(entry.queue.items);
  } finally {
    if (pickingUp === entry) pickingUp = null;
  }
}

/** The queue another device left to pick up, or null. */
export function useOtherDevice(): OtherDevice | null {
  return useSyncExternalStore(subscribeListed, getListed, getListed);
}

function subscribeListed(listener: () => void): () => void {
  listedListeners.add(listener);
  return function unsubscribe(): void {
    listedListeners.delete(listener);
  };
}

function getListed(): OtherDevice | null {
  return listed;
}

function setListed(next: Listed | null): void {
  if (listed === next) return;
  listed = next;
  listedListeners.forEach((listener) => listener());
}

function end(s: Sync): void {
  sync = null;
  s.stops.forEach((stop) => stop());
  setListed(null);
}

function heardSave(s: Sync, { queue, playing, baseline }: QueueSaved): void {
  s.latest = queue;
  const save = remoteSaveFor(queue);
  if (!save) return;
  const key = saveKey(save);
  const now = Date.now();
  // The listener hasn't touched a restored or taken-over queue here, so it
  // isn't news. Sending it at launch could replace another device's newer one.
  if (baseline) {
    s.sent = { key, positionMs: save.positionMs, at: now };
    if (s.pending) void check(s);
    return;
  }
  if (s.sent?.key === key) {
    const moved =
      Math.abs(s.sent.positionMs - save.positionMs) >= POSITION_MOVE_MS;
    if (!moved || (playing && now - s.sent.at < SAVE_WHILE_PLAYING_MS)) return;
  }
  s.sent = { key, positionMs: save.positionMs, at: now };
  void send(s, save);
}

/**
 * The queue as the server takes it: up to 200 tracks around the current one,
 * with the current one's place in them. Null when no track is current.
 */
function remoteSaveFor(queue: SavedQueue): RemoteSave | null {
  const index = queue.items.findIndex((item) => item.id === queue.currentId);
  if (index < 0) return null;
  const start = Math.max(
    0,
    Math.min(index - HISTORY_KEPT, queue.items.length - MAX_TRACKS),
  );
  return {
    streamPaths: queue.items
      .slice(start, start + MAX_TRACKS)
      .map((item) => item.streamPath),
    current: index - start,
    positionMs: Math.round(queue.positionSeconds * 1000),
  };
}

function saveKey(save: RemoteSave): string {
  return JSON.stringify([save.streamPaths, save.current]);
}

/** Saves run one at a time, so an older one can't land after a newer one. */
function send(s: Sync, save: RemoteSave): Promise<void> {
  s.saving = s.saving.then(async () => {
    await s.ready;
    if (sync !== s) return;
    if (isOffline()) {
      markPending(s);
      return;
    }
    try {
      const changed = await savePlayQueue({ ...save, device: s.device });
      if (sync !== s) return;
      if (changed !== null) {
        s.seen = Math.max(s.seen, changed);
        // Aurral holds this phone's queue now, in place of the other's.
        if (listed && listed.savedAt < changed) setListed(null);
      }
      s.pending = false;
      writeRecord(s);
    } catch {
      if (sync !== s) return;
      // The next save tries again, and so does the server coming back.
      s.sent = null;
      markPending(s);
    }
  });
  return s.saving;
}

function markPending(s: Sync): void {
  if (s.pending) return;
  s.pending = true;
  writeRecord(s);
}

/** Send the change the server missed. */
async function sendPending(s: Sync): Promise<void> {
  const save = s.latest && remoteSaveFor(s.latest);
  // Nothing saved here yet this run: a restore may still be on its way, and
  // it checks again when it lands.
  if (!save) return;
  s.sent = { key: saveKey(save), positionMs: save.positionMs, at: Date.now() };
  await send(s, save);
}

/** One check at a time; a trigger during one runs another after it. */
async function check(s: Sync): Promise<void> {
  if (s.checking) {
    s.checkAgain = true;
    return;
  }
  s.checking = true;
  try {
    do {
      s.checkAgain = false;
      await checkOnce(s);
    } while (s.checkAgain && sync === s);
  } finally {
    s.checking = false;
  }
}

/**
 * Ask the server for the account's queue. Another device's newer queue loads
 * here if nothing is queued, and is otherwise listed for the listener to pick
 * up. The server's copy gets this phone's change if no other device has saved
 * since.
 */
async function checkOnce(s: Sync): Promise<void> {
  await s.ready;
  if (sync !== s || isOffline()) return;
  // A play the listener starts while the server answers wins over its queue.
  const plays = listenerPlayCount();
  let remote: PlayQueue | null;
  try {
    remote = await getPlayQueue();
  } catch {
    return;
  }
  if (sync !== s) return;

  if (!remote || remote.changedBy === s.device || remote.changed <= s.seen) {
    if (remote?.changedBy === s.device && remote.changed > s.seen) {
      s.seen = remote.changed;
      writeRecord(s);
    }
    // Cleared, saved over by this phone, or already taken here.
    setListed(null);
    if (s.pending) await sendPending(s);
    return;
  }
  // The listener is listening here, so this phone's queue goes up as it plays.
  if (s.pending && isPlaybackActive()) {
    await sendPending(s);
    return;
  }

  const name = deviceLabel(remote.changedBy);
  const queue = queueElsewhere(remote, name);
  if (!queue) return;
  // Another device saved after this phone's last save, so the listener
  // chooses. The queue here goes up again once they play or change it.
  if (s.pending) {
    s.pending = false;
    writeRecord(s);
  }
  const result = await takeOverQueue(queue, { play: false, idleSince: plays });
  if (sync !== s) return;
  if (result === "loaded") {
    s.seen = Math.max(s.seen, remote.changed);
    writeRecord(s);
    setListed(null);
    s.onTakenOver(queue.items);
    return;
  }
  const track = queue.items.find((item) => item.id === queue.startId);
  if (!track) return;
  setListed({
    name,
    track,
    positionSeconds: queue.positionSeconds,
    savedAt: remote.changed,
    queue,
  });
}

/**
 * The server's queue as the player takes it. A Subsonic client may queue a
 * track twice, and the player holds each once: the current one where it is,
 * any other at its first place. Null when the current track can't play.
 */
function queueElsewhere(
  remote: PlayQueue,
  from: string,
): QueueElsewhere | null {
  const current = remote.tracks[remote.currentIndex];
  if (!current) return null;
  const items: PlayerTrack[] = [];
  const ids = new Set<string>();
  remote.tracks.forEach((track, index) => {
    if (ids.has(track.id)) return;
    if (track.id === current.id && index !== remote.currentIndex) return;
    const item = queueTrackToPlayerTrack(track, null);
    if (!item) return;
    ids.add(item.id);
    items.push(item);
  });
  if (!ids.has(current.id)) return null;
  return {
    items,
    startId: current.id,
    positionSeconds: remote.positionMs / 1000,
    durationSeconds: (current.durationMs ?? 0) / 1000,
    album: {
      albumTitle: `From ${from}`,
      artistName: "",
      coverPath: null,
      artworkUrl: null,
      albumMbid: null,
      artistMbid: null,
    },
  };
}

/**
 * Aurral's own players end their name with a random tag that only tells two
 * of them apart, as in "Aurral web 1a2b3c4d".
 */
function deviceLabel(name: string): string {
  return /^(Aurral .+) [0-9a-f]{4,8}$/.exec(name)?.[1] ?? name;
}

/** Named once per install, so the account's other clients can tell it apart. */
async function readDevice(): Promise<string> {
  const stored = await SecureStorage.getPlayerDevice();
  if (stored) return stored;
  const model =
    Constants.deviceName?.trim().slice(0, 60) ||
    (IS_IOS ? "iPhone" : "Android");
  const tag = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0");
  const created = `${DEVICE_PREFIX} on ${model} ${tag}`;
  await SecureStorage.setPlayerDevice(created);
  return created;
}

async function readRecord(): Promise<{ seen: number; pending: boolean }> {
  try {
    const parsed: unknown = JSON.parse((await AppStorage.getQueueSync()) ?? "");
    if (typeof parsed === "object" && parsed !== null) {
      const { seen, pending } = parsed as Record<string, unknown>;
      return {
        seen: typeof seen === "number" && Number.isFinite(seen) ? seen : 0,
        pending: pending === true,
      };
    }
  } catch {}
  return { seen: 0, pending: false };
}

function writeRecord(s: Sync): void {
  const record = JSON.stringify({ seen: s.seen, pending: s.pending });
  writes = writes
    .then(() => (sync === s ? AppStorage.setQueueSync(record) : undefined))
    .catch(() => {});
}

/** Hear the app come back from the background. Returns unsubscribe. */
function onForeground(listener: () => void): () => void {
  let wasBackground = AppState.currentState === "background";
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "background") wasBackground = true;
    else if (state === "active" && wasBackground) {
      wasBackground = false;
      listener();
    }
  });
  return () => subscription.remove();
}
