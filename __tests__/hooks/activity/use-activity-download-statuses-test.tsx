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
import type {
  ActivityHistoryItem,
  ActivityItem,
  AlbumRequest,
} from "@/lib/types/activity";

const mockGetDownloadStatuses = getDownloadStatuses as jest.Mock;

function lidarrRequest(overrides: Partial<AlbumRequest>): AlbumRequest {
  return {
    id: `lidarr-${overrides.albumId}`,
    type: "album",
    albumId: null,
    albumMbid: null,
    albumName: "Album",
    artistId: null,
    artistMbid: null,
    artistName: "Artist",
    status: "processing",
    requestedAt: "2026-11-01T00:00:00.000Z",
    mbid: null,
    name: "Album",
    image: null,
    inQueue: false,
    ...overrides,
  };
}

function historyItem(
  overrides: Partial<ActivityHistoryItem>,
): ActivityHistoryItem {
  return {
    id: `history-${overrides.kind}-${overrides.albumId}`,
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
    albumId: null,
    canonicalAlbumId: null,
    requestedBy: null,
    sourceFilename: null,
    inQueue: false,
    canReSearch: false,
    ...overrides,
  };
}

// Aurral writes its request as completed the moment it queues the album.
const aurralRequest = historyItem({ albumId: "12", canonicalAlbumId: "12" });

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
  it("asks for an Aurral request's album by canonical id, and skips settled and cancelled rows", async () => {
    await renderStatuses([
      lidarrRequest({ albumId: "301", inQueue: true }),
      lidarrRequest({ albumId: "302", status: "available" }),
      aurralRequest,
      // Carries the same canonical id in albumId, but is not an album row.
      historyItem({
        kind: "missing_track_search",
        albumId: "12",
        statusLabel: "Queued",
      }),
      historyItem({
        source: "lidarr",
        albumId: "303",
        status: "cancelled",
        statusLabel: "Cancelled",
      }),
    ]);

    expect(mockGetDownloadStatuses).toHaveBeenCalledTimes(1);
    expect(mockGetDownloadStatuses).toHaveBeenCalledWith(["301", "aurral:12"]);
  });

  it("stops polling an Aurral album once its downloads are cancelled", async () => {
    mockGetDownloadStatuses
      .mockResolvedValueOnce({ "aurral:12": { status: "downloading" } })
      .mockResolvedValue({ "aurral:12": { status: "cancelled" } });

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
