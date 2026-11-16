import {
  compareActivityItems,
  getActivityStatus,
  isQueueItem,
  matchesActivityType,
  matchesActivityView,
} from "@/lib/activity-views";
import type { ActivityItem } from "@/lib/types/activity";

function history(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "hist-1",
    type: "activity",
    source: "aurral",
    kind: "track_download",
    title: "Downloading a track",
    subtitle: null,
    status: "completed",
    statusLabel: "Downloaded",
    requestedAt: "2026-08-01T00:00:00.000Z",
    href: null,
    playlistId: null,
    jobId: null,
    trackName: null,
    artistName: null,
    albumName: null,
    libraryAlbumId: null,
    requestedBy: null,
    sourceFilename: null,
    upgrade: null,
    inQueue: false,
    ...overrides,
  };
}

describe("isQueueItem", () => {
  it("excludes blocked jobs even when they look in-flight", () => {
    expect(isQueueItem(history({ status: "blocked", inQueue: true }))).toBe(
      false,
    );
  });

  it("includes inQueue, processing and pending", () => {
    expect(isQueueItem(history({ inQueue: true }))).toBe(true);
    expect(isQueueItem(history({ status: "processing" }))).toBe(true);
    expect(isQueueItem(history({ status: "pending" }))).toBe(true);
  });

  it("excludes settled entries", () => {
    expect(isQueueItem(history({ status: "completed" }))).toBe(false);
  });
});

describe("matchesActivityView", () => {
  const blocked = history({ status: "blocked" });
  const queued = history({ status: "processing" });
  const done = history({ status: "completed" });

  it("routes each item to exactly one view", () => {
    for (const item of [blocked, queued, done] as ActivityItem[]) {
      const views = (["queue", "review", "history"] as const).filter((view) =>
        matchesActivityView(item, view),
      );
      expect(views).toHaveLength(1);
    }
  });

  it("sends blocked jobs to review", () => {
    expect(matchesActivityView(blocked, "review")).toBe(true);
  });

  it("keeps blocked jobs out of history", () => {
    expect(matchesActivityView(blocked, "history")).toBe(false);
  });

  it("sends settled entries to history", () => {
    expect(matchesActivityView(done, "history")).toBe(true);
  });
});

describe("compareActivityItems", () => {
  it("sorts newest first", () => {
    const a = history({ id: "a", requestedAt: "2026-08-05T00:00:00.000Z" });
    const b = history({ id: "b", requestedAt: "2026-07-01T00:00:00.000Z" });
    expect([b, a].sort(compareActivityItems).map((i) => i.id)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("matchesActivityType", () => {
  it("keeps everything under all", () => {
    expect(matchesActivityType(history(), "all")).toBe(true);
  });

  it("counts album requests as requests", () => {
    const request = history({ kind: "album_requested" });
    expect(matchesActivityType(request, "requests")).toBe(true);
    expect(matchesActivityType(request, "downloads")).toBe(false);
  });

  it("groups both track kinds under downloads", () => {
    expect(
      matchesActivityType(history({ kind: "track_download" }), "downloads"),
    ).toBe(true);
    expect(
      matchesActivityType(
        history({ kind: "missing_track_search" }),
        "downloads",
      ),
    ).toBe(true);
  });

  it("groups artist adds under library", () => {
    expect(
      matchesActivityType(history({ kind: "artist_added" }), "library"),
    ).toBe(true);
  });
});

describe("getActivityStatus", () => {
  // Expected buckets come from the web's activityNavConfig.ts.
  it.each([
    ["a pending job", history({ status: "pending" }), "queued"],
    [
      "a download",
      history({ status: "processing", statusLabel: "Downloading" }),
      "downloading",
    ],
    [
      "a waiting job",
      history({ status: "processing", statusLabel: "Waiting" }),
      "downloading",
    ],
    [
      "a request being searched",
      history({ status: "processing", statusLabel: "Requested" }),
      "searching",
    ],
    [
      "a job being cancelled",
      history({ status: "processing", statusLabel: "Cancelling" }),
      null,
    ],
    [
      "a reused track",
      history({ status: "completed", statusLabel: "Reused" }),
      "downloaded",
    ],
    [
      "an upgrade",
      history({ upgrade: { fromQuality: "MP3 320" } }),
      "upgraded",
    ],
    [
      "an added artist",
      history({ kind: "artist_added", statusLabel: "Added" }),
      null,
    ],
    [
      "a failed request",
      history({ kind: "album_requested", status: "failed" }),
      "failed",
    ],
    ["a cancelled job", history({ status: "cancelled" }), "cancelled"],
    ["a blocked job", history({ status: "blocked" }), null],
  ])("files %s", (_name, item, expected) => {
    expect(getActivityStatus(item)).toBe(expected);
  });
});
