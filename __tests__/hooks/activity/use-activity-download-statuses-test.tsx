jest.mock("@/lib/api/library", () => ({
  getDownloadStatuses: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock("expo-router/react-navigation", () => ({
  useIsFocused: () => true,
}));

import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useActivityDownloadStatuses } from "@/hooks/activity/use-activity-download-statuses";
import { getDownloadStatuses } from "@/lib/api/library";
import type { ActivityItem } from "@/lib/types/activity";

const mockGetDownloadStatuses = getDownloadStatuses as jest.Mock;

function historyItem(overrides: Partial<ActivityItem>): ActivityItem {
  return {
    id: `history-${overrides.kind}-${overrides.libraryAlbumId}`,
    type: "activity",
    source: "aurral",
    kind: "album_requested",
    title: "Requested Album",
    subtitle: "Artist",
    status: "completed",
    statusLabel: "Requested",
    requestedAt: "2026-11-01T00:00:00.000Z",
    href: null,
    playlistId: null,
    jobId: null,
    trackName: null,
    artistName: "Artist",
    albumName: "Album",
    libraryAlbumId: null,
    requestedBy: null,
    sourceFilename: null,
    upgrade: null,
    inQueue: false,
    ...overrides,
  };
}

// Aurral writes its request as completed the moment it queues the album.
const aurralRequest = historyItem({ libraryAlbumId: "12" });

let client: QueryClient;

async function renderStatuses(items: ActivityItem[]) {
  return renderHook(() => useActivityDownloadStatuses(items), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockGetDownloadStatuses.mockReset();
  mockGetDownloadStatuses.mockResolvedValue({});
  // Infinity schedules no gc timer, which would hold Jest open.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

afterEach(() => {
  client.clear();
  jest.useRealTimers();
});

describe("useActivityDownloadStatuses", () => {
  it("asks only for an album request's album, by its Library id", async () => {
    await renderStatuses([
      aurralRequest,
      // Carries a Library id, but is not an album request.
      historyItem({
        kind: "missing_track_search",
        libraryAlbumId: "13",
        statusLabel: "Queued",
      }),
      // A track's own status says how its download went.
      historyItem({
        kind: "track_download",
        status: "processing",
        statusLabel: "Downloading",
        libraryAlbumId: "40",
      }),
    ]);

    expect(mockGetDownloadStatuses).toHaveBeenCalledTimes(1);
    expect(mockGetDownloadStatuses).toHaveBeenCalledWith(["12"]);
  });

  it("stops polling an Aurral album once its downloads are cancelled", async () => {
    mockGetDownloadStatuses
      .mockResolvedValueOnce({ "12": { status: "downloading" } })
      .mockResolvedValue({ "12": { status: "cancelled" } });

    await renderStatuses([aurralRequest]);
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(mockGetDownloadStatuses).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(mockGetDownloadStatuses).toHaveBeenCalledTimes(2);
  });
});
