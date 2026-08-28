import { ApiError } from "@/lib/api/client";
import { recordPlayEvent } from "@/lib/api/play-events";
import { onProgress, onTrackCompleted } from "@/lib/player/player";
import type { PlaybackProgress } from "@/lib/player/player";
import type { PlayerTrack } from "@/lib/player/track-item";
import type { PlayEventInput } from "@/lib/types/play-events";
import { AppStorage } from "@/lib/storage";

/**
 * Play history: what pocket tells Aurral it played.
 *
 * The server keeps the history and forwards each play to whichever scrobble
 * providers the account linked. Pocket links nothing and reads no provider
 * status — linking happens on the web app. Reporting is all pocket does.
 *
 * A play is reported when a track reaches its natural end, which is what the
 * Aurral web player reports too. A skip is not a play, however far in it came.
 *
 * Only library tracks are reported. A preview clip is a 30-second sample from
 * a discovery surface, not something the user chose to listen to.
 */

/** The value Aurral stores in a play event's `source` column. */
const SOURCE = "pocket";

/**
 * Plays that have not reached the server yet, oldest first. A phone loses its
 * connection mid-track often enough that dropping the play would be wrong,
 * and the server is the only place this history lives.
 */
const MAX_PENDING = 100;

let lastProgress: PlaybackProgress | null = null;
/** Writes and sends run one at a time, so a burst cannot land out of order. */
let work: Promise<void> = Promise.resolve();

/**
 * Start reporting plays. Call once, after the session token is in place —
 * anything held over from a previous run is sent first. Returns a function
 * that stops reporting.
 */
export function startPlayHistory(): () => void {
  const stopProgress = onProgress((progress) => {
    lastProgress = progress;
  });
  const stopCompleted = onTrackCompleted((track) => {
    const event = toPlayEvent(track);
    if (event) enqueue(event);
  });
  flushSoon();

  return function stop(): void {
    stopProgress();
    stopCompleted();
    lastProgress = null;
  };
}

/**
 * Drop every unsent play. Sign-out calls this: a play belongs to the account
 * that played it, and must not reach the next one to sign in.
 */
export function forgetPlayHistory(): Promise<void> {
  work = work.then(() => AppStorage.deletePlayEventOutbox()).catch(() => {});
  return work;
}

function toPlayEvent(track: PlayerTrack): PlayEventInput | null {
  if (!track.streamPath) return null;

  // The engine reports a track's length as it streams, so the duration comes
  // from the last progress report rather than from the queued track, whose
  // own duration is zero until the engine fills it in.
  const seconds =
    lastProgress?.trackId === track.id ? lastProgress.duration : 0;

  return {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album || null,
    artistMbid: track.artistMbid,
    albumMbid: track.albumMbid,
    trackMbid: track.trackMbid,
    durationMs: seconds > 0 ? Math.round(seconds * 1000) : null,
    playedAt: Date.now(),
    source: SOURCE,
  };
}

function enqueue(event: PlayEventInput): void {
  work = work
    .then(async () => {
      const pending = await readPending();
      await writePending([...pending, event]);
    })
    .catch(() => {});
  flushSoon();
}

function flushSoon(): void {
  work = work.then(flush).catch(() => {});
}

/**
 * Send what is waiting, oldest first, and stop at the first play the server
 * did not take. Stopping keeps the order: a later play must not overtake one
 * the server is still refusing.
 */
async function flush(): Promise<void> {
  const pending = await readPending();
  if (pending.length === 0) return;

  let sent = 0;
  for (const event of pending) {
    if (!(await send(event))) break;
    sent += 1;
  }
  if (sent === 0) return;
  await writePending(pending.slice(sent));
}

/**
 * True when the play is done with — the server took it, or rejected it on its
 * merits. A rejected payload never becomes acceptable, so keeping it would
 * block every play behind it forever. Network trouble and a server fault are
 * the retryable cases.
 */
async function send(event: PlayEventInput): Promise<boolean> {
  try {
    await recordPlayEvent(event);
    return true;
  } catch (error) {
    if (error instanceof ApiError) {
      return error.status >= 400 && error.status < 500 && error.status !== 401;
    }
    return false;
  }
}

async function readPending(): Promise<PlayEventInput[]> {
  const raw = await AppStorage.getPlayEventOutbox();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPlayEvent) : [];
  } catch {
    return [];
  }
}

async function writePending(events: PlayEventInput[]): Promise<void> {
  if (events.length === 0) {
    await AppStorage.deletePlayEventOutbox();
    return;
  }
  // Over the cap the oldest plays go: the newest listening is the history
  // worth keeping, and an outbox that only grows would never be sent.
  const kept = events.slice(-MAX_PENDING);
  await AppStorage.setPlayEventOutbox(JSON.stringify(kept));
}

function isPlayEvent(value: unknown): value is PlayEventInput {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.trackId === "string" &&
    typeof event.title === "string" &&
    typeof event.artist === "string" &&
    typeof event.playedAt === "number"
  );
}
