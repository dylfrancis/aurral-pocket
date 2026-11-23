import { api } from "./client";
import type {
  NowPlayingInput,
  PlayEvent,
  PlayEventInput,
} from "@/lib/types/play-events";

/**
 * A now playing this slow is stale, and the next track's waits behind it. The
 * server answers before it passes the track on, so a reply is quick.
 */
const NOW_PLAYING_TIMEOUT_MS = 10_000;

type RecordPlayEventResponse = {
  event?: PlayEvent;
};

/**
 * Report one play. The server answers 400 for a payload without trackId,
 * title, and artist; every other field is optional.
 */
export async function recordPlayEvent(input: PlayEventInput) {
  const r = await api.post<RecordPlayEventResponse>("/play-events", input);
  return r.data?.event ?? null;
}

/**
 * Tell the server what just started playing. It passes the track on to the
 * linked scrobble services and to the people who can see the account's
 * listening, and records nothing. It answers 202 before any of them replies.
 */
export async function sendNowPlaying(input: NowPlayingInput) {
  await api.post("/play-events/now-playing", input, {
    timeout: NOW_PLAYING_TIMEOUT_MS,
  });
}
