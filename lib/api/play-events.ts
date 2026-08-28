import { api } from "./client";
import type { PlayEvent, PlayEventInput } from "@/lib/types/play-events";

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
