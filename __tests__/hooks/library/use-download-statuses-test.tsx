jest.mock("@/lib/api/library", () => ({
  getDownloadStatuses: jest.fn(),
}));

import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { getDownloadStatuses } from "@/lib/api/library";
import type { Album } from "@/lib/types/library";

const mockGetDownloadStatuses = getDownloadStatuses as jest.Mock;

const wantedAurralAlbum: Album = {
  id: "7",
  canonicalId: "7",
  managedBy: "aurral",
  artistId: "3",
  artistName: "Artist",
  mbid: "rg-7",
  foreignAlbumId: "rg-7",
  albumName: "Album",
  title: "Album",
  releaseDate: "2026-01-01",
  monitored: true,
  statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
};

let client: QueryClient;

beforeEach(() => {
  jest.useFakeTimers();
  mockGetDownloadStatuses.mockReset();
  // Infinity schedules no gc timer, which would hold Jest open.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

afterEach(() => {
  client.clear();
  jest.useRealTimers();
});

describe("useDownloadStatuses", () => {
  it("polls an Aurral album while it is queued and stops once it is cancelled", async () => {
    mockGetDownloadStatuses
      .mockResolvedValueOnce({ "aurral:7": { status: "queued" } })
      .mockResolvedValue({ "aurral:7": { status: "cancelled" } });

    await renderHook(() => useDownloadStatuses([wantedAurralAlbum]), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(mockGetDownloadStatuses).toHaveBeenCalledWith(["aurral:7"]);

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
