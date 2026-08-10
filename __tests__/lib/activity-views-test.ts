import {
  canReSearch,
  compareActivityItems,
  isQueueItem,
  matchesActivityType,
  matchesActivityView,
} from "@/lib/activity-views";
import type {
  ActivityHistoryItem,
  ActivityItem,
  AlbumRequest,
} from "@/lib/types/activity";

function album(overrides: Partial<AlbumRequest> = {}): AlbumRequest {
  return {
    id: "album-1",
    type: "album",
    albumId: "1",
    albumMbid: null,
    albumName: "An Album",
    artistId: null,
    artistMbid: null,
    artistName: "An Artist",
    status: "processing",
    requestedAt: "2026-08-01T00:00:00.000Z",
    mbid: null,
    name: "An Album",
    image: null,
    inQueue: true,
    ...overrides,
  };
}

function history(
  overrides: Partial<ActivityHistoryItem> = {},
): ActivityHistoryItem {
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
    albumId: null,
    requestedBy: null,
    sourceFilename: null,
    inQueue: false,
    canReSearch: false,
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
    expect(isQueueItem(album({ inQueue: true, status: "available" }))).toBe(
      true,
    );
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

describe("canReSearch", () => {
  it("uses the server flag for history entries", () => {
    expect(canReSearch(history({ canReSearch: true }))).toBe(true);
    expect(canReSearch(history({ canReSearch: false, status: "failed" }))).toBe(
      false,
    );
  });

  it("derives the equivalent condition for album requests", () => {
    expect(canReSearch(album({ status: "failed", albumId: "1" }))).toBe(true);
    expect(canReSearch(album({ status: "failed", albumId: null }))).toBe(false);
    expect(canReSearch(album({ status: "processing" }))).toBe(false);
  });
});

describe("compareActivityItems", () => {
  it("floats re-searchable failures above newer entries", () => {
    const older = history({
      id: "older",
      canReSearch: true,
      requestedAt: "2026-07-01T00:00:00.000Z",
    });
    const newer = history({
      id: "newer",
      requestedAt: "2026-08-05T00:00:00.000Z",
    });
    expect([newer, older].sort(compareActivityItems).map((i) => i.id)).toEqual([
      "older",
      "newer",
    ]);
  });

  it("otherwise sorts newest first", () => {
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
    expect(matchesActivityType(album(), "requests")).toBe(true);
    expect(matchesActivityType(album(), "downloads")).toBe(false);
  });

  it("groups both track kinds under downloads", () => {
    expect(
      matchesActivityType(history({ kind: "track_download" }), "downloads"),
    ).toBe(true);
    expect(
      matchesActivityType(
        history({ kind: "track_reused_lidarr" }),
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
