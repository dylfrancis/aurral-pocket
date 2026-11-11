import {
  activityJobControls,
  flowJobControls,
  type ActivityJobAccess,
} from "@/lib/track-job-controls";
import type { ActivityHistoryItem } from "@/lib/types/activity";
import type { FlowJobStatus } from "@/lib/types/flow";

describe("flowJobControls", () => {
  it.each([
    ["pending", { canStop: true, restarts: true }],
    ["downloading", { canStop: true, restarts: true }],
    // Already stopping: Restart only.
    ["cancel_requested", { canStop: false, restarts: true }],
    ["failed", { canStop: false, restarts: false }],
    ["cancelled", { canStop: false, restarts: false }],
    ["done", null],
    ["blocked", null],
    // A flow pick that was never downloaded.
    ["saved", null],
  ])("%s offers %j", (status, controls) => {
    expect(flowJobControls(status as FlowJobStatus)).toEqual(controls);
  });
});

describe("activityJobControls", () => {
  const download = (
    overrides: Partial<ActivityHistoryItem> = {},
  ): ActivityHistoryItem => ({
    id: "aurral-track_download-j1",
    type: "activity",
    source: "aurral",
    kind: "track_download",
    title: "Downloading Idioteque",
    subtitle: "Radiohead · Library",
    status: "processing",
    statusLabel: "Downloading",
    requestedAt: "2026-11-09T00:00:00.000Z",
    href: null,
    playlistId: "library",
    jobId: "j1",
    trackName: "Idioteque",
    artistName: "Radiohead",
    albumName: "Kid A",
    albumId: null,
    canonicalAlbumId: null,
    requestedBy: { id: 7, username: "me" },
    sourceFilename: null,
    upgrade: null,
    inQueue: false,
    canReSearch: false,
    ...overrides,
  });
  const flowUser: ActivityJobAccess = { userId: 7, hasAccessFlow: true };

  it.each([
    ["pending", { canStop: true, restarts: true }],
    ["processing", { canStop: true, restarts: true }],
    ["failed", { canStop: false, restarts: false }],
    ["cancelled", { canStop: false, restarts: false }],
    ["blocked", null],
    ["completed", null],
  ])("a %s download offers %j", (status, controls) => {
    expect(activityJobControls(download({ status }), flowUser)).toEqual(
      controls && { jobId: "j1", trackName: "Idioteque", ...controls },
    );
  });

  it("offers nothing on an entry that isn't a track download", () => {
    expect(
      activityJobControls(download({ kind: "album_requested" }), flowUser),
    ).toBeNull();
    expect(activityJobControls(download({ jobId: null }), flowUser)).toBeNull();
  });

  describe("without accessFlow", () => {
    const libraryUser: ActivityJobAccess = { userId: 7, hasAccessFlow: false };

    it("controls the user's own album-track download", () => {
      expect(activityJobControls(download(), libraryUser)).not.toBeNull();
    });

    it.each([
      ["someone else's", download({ requestedBy: { id: 8, username: "x" } })],
      ["an unattributed", download({ requestedBy: null })],
      ["a flow's", download({ playlistId: "flow-1" })],
    ])("leaves %s download alone", (_label, item) => {
      expect(activityJobControls(item, libraryUser)).toBeNull();
    });
  });
});
