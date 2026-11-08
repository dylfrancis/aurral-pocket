import { ApiError } from "@/lib/api/client";
import { recordPlayEvent } from "@/lib/api/play-events";
import { onProgress, onTrackStarted } from "@/lib/player/player";
import type { PlaybackProgress } from "@/lib/player/player";
import type { PlayEventInput } from "@/lib/types/play-events";
import { AppStorage } from "@/lib/storage";

/**
 * Play history: what pocket tells Aurral it played.
 *
 * The server keeps the history and forwards each play to whichever scrobble
 * providers the account linked. Pocket links nothing and reads no provider
 * status — linking happens on the web app. Reporting is all pocket does.
 *
 * A play counts once the listener has heard half the track or four minutes,
 * whichever comes first, the same rule as the Aurral web player. Seeking adds no
 * listening time, and skipping after that point still leaves the play counted.
 *
 * Only library, flow and playlist tracks are reported, and a flow or playlist
 * can opt out. A
 * preview clip is a 30-second sample from a discovery surface, not something
 * the user chose to listen to.
 */

/** The value Aurral stores in a play event's `source` column. */
const SOURCE = "pocket";

/** A track of this length or shorter never counts as a play. */
const MIN_DURATION_SECONDS = 30;

/** Hearing this much is a play, however long the track runs. */
const MAX_LISTEN_SECONDS = 240;

/**
 * The most that one progress report can add to the listening time. Reports come
 * at most five seconds apart, so a bigger move is a seek the engine did not flag:
 * on iOS the flag goes to the next report, which can come before the jump.
 */
const MAX_REPORT_GAP_SECONDS = 10;

/**
 * Plays that have not reached the server yet, oldest first. A phone loses its
 * connection mid-track often enough that dropping the play would be wrong,
 * and the server is the only place this history lives.
 */
const MAX_PENDING = 100;

/** Writes and sends run one at a time, so a burst cannot land out of order. */
let work: Promise<void> = Promise.resolve();

/**
 * Start reporting plays. Call once, after the session token is in place —
 * anything held over from a previous run is sent first. Returns a function
 * that stops reporting.
 */
export function startPlayHistory(): () => void {
  let reachesPlay = createPlayTracker();
  const stopStarted = onTrackStarted(() => {
    reachesPlay = createPlayTracker();
  });
  const stopProgress = onProgress((progress) => {
    if (!reachesPlay(progress)) return;
    const event = toPlayEvent(progress);
    if (event) enqueue(event);
  });
  flushSoon();

  return function stop(): void {
    stopStarted();
    stopProgress();
  };
}

/**
 * Tracks the listening time of one play. The function it returns takes each
 * progress report and answers true on the one report that makes it a play.
 */
function createPlayTracker(): (progress: PlaybackProgress) => boolean {
  let listened = 0;
  let lastPosition: number | null = null;
  let counted = false;

  return function reachesPlay({ position, duration, seeked }): boolean {
    const advanced = lastPosition === null ? 0 : position - lastPosition;
    lastPosition = position;
    // Only a report that adds listening can complete a play. The first report of
    // the next track can arrive before its track change, carrying that track's
    // length, and must not be measured against what was heard of this one.
    if (seeked || advanced <= 0 || advanced > MAX_REPORT_GAP_SECONDS) {
      return false;
    }
    listened += advanced;

    if (counted || duration <= MIN_DURATION_SECONDS) return false;
    counted = listened >= Math.min(duration / 2, MAX_LISTEN_SECONDS);
    return counted;
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

function toPlayEvent({
  track,
  duration,
}: PlaybackProgress): PlayEventInput | null {
  if (!track.streamPath || track.recordHistory === false) return null;

  return {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album || null,
    artistMbid: track.artistMbid,
    albumMbid: track.albumMbid,
    trackMbid: track.trackMbid,
    // The engine reports a track's length as it streams, so the duration comes
    // from the progress report rather than from the queued track, whose own
    // duration is zero until the engine fills it in.
    durationMs: Math.round(duration * 1000),
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
