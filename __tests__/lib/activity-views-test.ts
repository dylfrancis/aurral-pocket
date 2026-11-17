import { describeActivityCause } from "@/lib/activity-views";
import type { ActivityCauseGroup } from "@/lib/types/activity";

function group(overrides: Partial<ActivityCauseGroup>): ActivityCauseGroup {
  return {
    kind: "request",
    playlistId: null,
    name: null,
    syncedFrom: null,
    key: "request",
    count: 1,
    since: "2026-11-17T12:00:00.000Z",
    ...overrides,
  };
}

describe("describeActivityCause", () => {
  // The web's wording (ActivityCauses.tsx), so both name a group alike.
  it.each([
    [
      "a flow by name",
      group({ kind: "flow", name: "Discover Weekly" }),
      { title: "Discover Weekly", why: "flow refresh" },
    ],
    [
      "a synced playlist by its service",
      group({ kind: "playlist", name: "Road Trip", syncedFrom: "Spotify" }),
      { title: "Road Trip", why: "synced from Spotify" },
    ],
    [
      "a playlist that doesn't sync",
      group({ kind: "playlist", name: "Road Trip" }),
      { title: "Road Trip", why: "added to the playlist" },
    ],
    [
      "monitoring of one artist",
      group({ kind: "monitoring", subject: "Radiohead", subjects: 1 }),
      { title: "Artist monitoring", why: "new music from Radiohead" },
    ],
    [
      "monitoring of several artists",
      group({ kind: "monitoring", subject: null, subjects: 3 }),
      { title: "Artist monitoring", why: "new music from 3 artists" },
    ],
    [
      "missing tracks from an unnamed album",
      group({ kind: "missing", subject: null, subjects: 0 }),
      { title: "Missing tracks", why: null },
    ],
  ])("names %s", (_name, cause, expected) => {
    expect(describeActivityCause(cause)).toEqual(expected);
  });
});
