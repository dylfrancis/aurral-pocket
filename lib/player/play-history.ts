import { ApiError } from "@/lib/api/client";
import { recordPlayEvent, sendNowPlaying } from "@/lib/api/play-events";
import {
  onPlaybackStateChange,
  onProgress,
  onTrackStarted,
} from "@/lib/player/player";
import type { PlaybackProgress } from "@/lib/player/player";
import type { PlayerTrack } from "@/lib/player/track-item";
import type { NowPlayingInput, PlayEventInput } from "@/lib/types/play-events";
import { AppStorage } from "@/lib/storage";

/**
 * Play history: what pocket tells Aurral it played.
 *
 * The server keeps the history and forwards each play to whichever scrobble
 * providers the account linked. Settings > Listening shows and changes those
 * links; this module only reports the plays.
 *
 * A play counts once the listener has heard half the track or four minutes,
 * whichever comes first, the same rule as the Aurral web player. Seeking adds no
 * listening time, and skipping after that point still leaves the play counted.
 *
 * Once a track starts playing, pocket also says it is now playing, which the
 * server passes on live. A track that is loaded but stays paused sends
 * nothing. The server keeps now playing for one track length from when it
 * hears it, which a pause can outlast, so playing on after a pause says it
 * again. Now playing skips the outbox: it is stale by the next track, so a
 * failed send is dropped.
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
 * How long now playing waits for the engine to learn the track's length. The
 * server shows a track without one for four minutes, which a longer track
 * outlasts, so the wait is worth a few seconds.
 */
const NOW_PLAYING_LENGTH_WAIT_SECONDS = 10;

/**
 * Plays that have not reached the server yet, oldest first, kept per account.
 * A phone loses its connection mid-track often enough that dropping the play
 * would be wrong, and the server is the only place this history lives.
 */
const MAX_PENDING = 100;

/**
 * The server credits a play to whoever's token sends it, so a waiting play
 * keeps the account that played it. Plays saved by older versions have none.
 */
type PendingPlay = PlayEventInput & { userId?: number };

/** Writes and sends run one at a time, so a burst cannot land out of order. */
let work: Promise<void> = Promise.resolve();

/**
 * Now playing sends also go one at a time: the server shows whichever arrives
 * last, so a slow one must not land after the next track's. Only the newest
 * waiting one goes, because the ones before it are already stale.
 */
let nextNowPlaying: NowPlayingInput | null = null;
let sendingNowPlaying = false;

let reportingUserId: number | null = null;
let stopReporting: (() => void) | null = null;

/**
 * Start reporting an account's plays, sending what it held over first. Call
 * once the session token and user are in place, and again when the account
 * changes. Returns a function that stops reporting.
 *
 * One start replaces the one before: Siri can start reporting before any
 * screen does, and two reporters would send each play twice.
 */
export function startPlayHistory(userId: number): () => void {
  stopReporting?.();
  reportingUserId = userId;
  let tracker = createPlayTracker();
  const stopStarted = onTrackStarted(() => {
    tracker = createPlayTracker();
  });
  const stopState = onPlaybackStateChange((state) => {
    if (state === "paused" || state === "stopped") tracker.pause();
  });
  const stopProgress = onProgress((progress) => {
    const heard = tracker.hear(progress);
    if (heard.nowPlaying) announce(progress);
    if (!heard.played) return;
    const event = toPlayEvent(progress);
    if (event) enqueue(event, userId);
  });
  flushSoon(userId);

  const stop = (): void => {
    // A replaced start's stop leaves its replacement running.
    if (stopReporting !== stop) return;
    stopReporting = null;
    reportingUserId = null;
    // The client sends whichever token is current, and the next session can
    // be another account, or one with the same id on another server.
    nextNowPlaying = null;
    stopStarted();
    stopState();
    stopProgress();
  };
  stopReporting = stop;
  return stop;
}

/** What one progress report means for the track. */
type Heard = {
  /**
   * The track is playing, after it starts or a pause: once the length is
   * known, or the wait for it ends.
   */
  nowPlaying: boolean;
  /** The listener has heard enough for a play. True on one report. */
  played: boolean;
};

type PlayTracker = {
  /** Say what a progress report means for the track. */
  hear(progress: PlaybackProgress): Heard;
  /** Playback paused, so the next listening says now playing again. */
  pause(): void;
};

const HEARD_NOTHING: Heard = { nowPlaying: false, played: false };

/** Tracks the listening time of one play. */
function createPlayTracker(): PlayTracker {
  let listened = 0;
  let lastPosition: number | null = null;
  let announced = false;
  let counted = false;

  function hear({ position, duration, seeked }: PlaybackProgress): Heard {
    const advanced = lastPosition === null ? 0 : position - lastPosition;
    lastPosition = position;
    // Only a report that adds listening can complete a play. The first report of
    // the next track can arrive before its track change, carrying that track's
    // length, and must not be measured against what was heard of this one.
    if (seeked || advanced <= 0 || advanced > MAX_REPORT_GAP_SECONDS) {
      return HEARD_NOTHING;
    }
    listened += advanced;

    const nowPlaying =
      !announced &&
      (duration > 0 || listened >= NOW_PLAYING_LENGTH_WAIT_SECONDS);
    announced ||= nowPlaying;
    if (counted || duration <= MIN_DURATION_SECONDS) {
      return { nowPlaying, played: false };
    }
    counted = listened >= Math.min(duration / 2, MAX_LISTEN_SECONDS);
    return { nowPlaying, played: counted };
  }

  return {
    hear,
    pause() {
      announced = false;
    },
  };
}

/**
 * Drop every account's unsent plays. Change Server calls this: the plays
 * belong to the server they were played against. Sign-out keeps them for the
 * account to send when it signs back in.
 */
export function forgetPlayHistory(): Promise<void> {
  work = work.then(() => AppStorage.deletePlayEventOutbox()).catch(() => {});
  return work;
}

/** Never retried, like the web player's. */
function announce({ track, duration }: PlaybackProgress): void {
  if (!isReported(track)) return;
  nextNowPlaying = {
    ...trackFields(track, duration),
    streamPath: track.streamPath,
  };
  if (!sendingNowPlaying) void sendNowPlayingInTurn();
}

async function sendNowPlayingInTurn(): Promise<void> {
  sendingNowPlaying = true;
  while (nextNowPlaying) {
    const input = nextNowPlaying;
    nextNowPlaying = null;
    await sendNowPlaying(input).catch(() => {});
  }
  sendingNowPlaying = false;
}

function toPlayEvent({
  track,
  duration,
}: PlaybackProgress): PlayEventInput | null {
  if (!isReported(track)) return null;

  return {
    ...trackFields(track, duration),
    playedAt: Date.now(),
    source: SOURCE,
  };
}

function isReported(
  track: PlayerTrack,
): track is PlayerTrack & { streamPath: string } {
  return !!track.streamPath && track.recordHistory !== false;
}

function trackFields(track: PlayerTrack, duration: number) {
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
    // duration is zero until the engine fills it in. Now playing can go
    // before it does.
    durationMs: duration > 0 ? Math.round(duration * 1000) : null,
  };
}

function enqueue(event: PlayEventInput, userId: number): void {
  work = work
    .then(async () => {
      const pending = await readPending();
      await writePending([...pending, { ...event, userId }]);
    })
    .catch(() => {});
  flushSoon(userId);
}

function flushSoon(userId: number): void {
  work = work.then(() => flush(userId)).catch(() => {});
}

/**
 * Send the account's waiting plays, oldest first, and stop at the first one
 * the server did not take. Stopping keeps the order: a later play must not
 * overtake one the server is still refusing.
 */
async function flush(userId: number): Promise<void> {
  const pending = await readPending();
  const sent = new Set<PendingPlay>();
  for (const play of pending) {
    // The client sends whichever token is current, so a flush that outlives
    // its account's session must not send another play.
    if (reportingUserId !== userId) break;
    if (!belongsTo(play, userId)) continue;
    if (!(await send(play))) break;
    sent.add(play);
  }
  if (sent.size === 0) return;
  await writePending(pending.filter((play) => !sent.has(play)));
}

/**
 * A play from an older version has no account and goes with whoever signs
 * in: one batch at most, and almost always the same person's.
 */
function belongsTo(play: PendingPlay, userId: number): boolean {
  return play.userId === undefined || play.userId === userId;
}

/**
 * True when the play is done with — the server took it, or rejected it on its
 * merits. A rejected payload never becomes acceptable, so keeping it would
 * block every play behind it forever. Network trouble and a server fault are
 * the retryable cases.
 */
async function send({ userId: _, ...event }: PendingPlay): Promise<boolean> {
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

async function readPending(): Promise<PendingPlay[]> {
  const raw = await AppStorage.getPlayEventOutbox();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPendingPlay) : [];
  } catch {
    return [];
  }
}

async function writePending(plays: PendingPlay[]): Promise<void> {
  if (plays.length === 0) {
    await AppStorage.deletePlayEventOutbox();
    return;
  }
  await AppStorage.setPlayEventOutbox(JSON.stringify(capPerAccount(plays)));
}

/**
 * Over the cap an account's oldest plays go: the newest listening is the
 * history worth keeping, and an outbox that only grows would never be sent.
 * Counting per account keeps one account's backlog from pushing out another's.
 */
function capPerAccount(plays: PendingPlay[]): PendingPlay[] {
  const counts = new Map<number | undefined, number>();
  const kept: PendingPlay[] = [];
  for (let index = plays.length - 1; index >= 0; index -= 1) {
    const play = plays[index];
    const count = counts.get(play.userId) ?? 0;
    if (count === MAX_PENDING) continue;
    counts.set(play.userId, count + 1);
    kept.push(play);
  }
  return kept.reverse();
}

function isPendingPlay(value: unknown): value is PendingPlay {
  if (typeof value !== "object" || value === null) return false;
  const play = value as Record<string, unknown>;
  return (
    typeof play.trackId === "string" &&
    typeof play.title === "string" &&
    typeof play.artist === "string" &&
    typeof play.playedAt === "number" &&
    (play.userId === undefined || typeof play.userId === "number")
  );
}
