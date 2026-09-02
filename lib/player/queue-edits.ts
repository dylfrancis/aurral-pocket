import type { PlayerTrack } from "@/lib/player/track-item";

/*
 * The queue-edit arithmetic, kept apart from the facade so it can be tested
 * without the audio engine. The facade applies these results to the engine
 * playlist and to its own order arrays in lockstep.
 */

/**
 * Drop tracks the queue already holds, and repeats within `items` itself.
 * The engine addresses tracks by id — playSong, reorder, remove — so one id
 * must not appear twice in a playlist, whichever side the repeat came from.
 * A track list that names the same track twice keeps its first position.
 */
export function withoutQueuedIds(
  items: PlayerTrack[],
  queue: PlayerTrack[],
): PlayerTrack[] {
  const queued = new Set(queue.map((item) => item.id));
  return items.filter((item) => {
    if (queued.has(item.id)) return false;
    queued.add(item.id);
    return true;
  });
}

/**
 * The index right after the track with `currentId`. An id the order does not
 * hold — including null — resolves to the front: the queue is about to play
 * from its head, so "next" means first.
 */
export function insertIndexAfter(
  order: PlayerTrack[],
  currentId: string | null,
): number {
  return order.findIndex((item) => item.id === currentId) + 1;
}

/** A copy of `order` with `items` inserted before position `index`. */
export function insertedAt(
  order: PlayerTrack[],
  items: PlayerTrack[],
  index: number,
): PlayerTrack[] {
  return [...order.slice(0, index), ...items, ...order.slice(index)];
}
