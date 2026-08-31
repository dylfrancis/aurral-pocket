import {
  insertedAt,
  insertIndexAfter,
  withoutQueuedIds,
} from "@/lib/player/queue-edits";
import type { PlayerTrack } from "@/lib/player/track-item";

function track(id: string): PlayerTrack {
  return {
    id,
    title: `Track ${id}`,
    artist: "Artist",
    album: "Album",
    duration: 0,
    url: `https://example.test/${id}`,
    artwork: null,
    streamPath: `/stream/${id}`,
    trackMbid: null,
    artistMbid: null,
    albumMbid: null,
  };
}

const queue = [track("a"), track("b"), track("c")];

describe("withoutQueuedIds", () => {
  it("drops tracks the queue already holds", () => {
    const result = withoutQueuedIds([track("b"), track("d")], queue);
    expect(result.map((item) => item.id)).toEqual(["d"]);
  });

  it("keeps everything against an empty queue", () => {
    const items = [track("a"), track("b")];
    expect(withoutQueuedIds(items, [])).toEqual(items);
  });

  it("returns empty when every track is queued", () => {
    expect(withoutQueuedIds([track("a"), track("c")], queue)).toEqual([]);
  });
});

describe("insertIndexAfter", () => {
  it("points right after the current track", () => {
    expect(insertIndexAfter(queue, "b")).toBe(2);
  });

  it("points past the end when the current track is last", () => {
    expect(insertIndexAfter(queue, "c")).toBe(3);
  });

  it("points at the front for an unknown id", () => {
    expect(insertIndexAfter(queue, "zz")).toBe(0);
  });

  it("points at the front for null", () => {
    expect(insertIndexAfter(queue, null)).toBe(0);
  });
});

describe("insertedAt", () => {
  it("inserts in the middle without touching the original", () => {
    const items = [track("x"), track("y")];
    const result = insertedAt(queue, items, 1);
    expect(result.map((item) => item.id)).toEqual(["a", "x", "y", "b", "c"]);
    expect(queue.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("appends at the length index", () => {
    const result = insertedAt(queue, [track("x")], queue.length);
    expect(result.map((item) => item.id)).toEqual(["a", "b", "c", "x"]);
  });

  it("prepends at zero", () => {
    const result = insertedAt(queue, [track("x")], 0);
    expect(result.map((item) => item.id)).toEqual(["x", "a", "b", "c"]);
  });
});
