jest.mock("@/lib/api/library", () => ({
  getArtistDetails: jest.fn(),
}));

import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useArtistDetails } from "@/hooks/library/use-artist-details";
import { getArtistDetails } from "@/lib/api/library";
import type { ArtistDetails, ReleaseGroup } from "@/lib/types/library";

const mockGetArtistDetails = getArtistDetails as jest.Mock;

const release: ReleaseGroup = {
  id: "rg-1",
  title: "Dummy",
  "first-release-date": "1994-08-22",
  "primary-type": "Album",
  "secondary-types": [],
};

function details(pending: boolean, listenerCount?: number): ArtistDetails {
  return {
    tags: [],
    "release-groups": [{ ...release, listenerCount }],
    "release-stats-pending": pending,
  };
}

let client: QueryClient;

beforeEach(() => {
  jest.useFakeTimers();
  mockGetArtistDetails.mockReset();
  // Infinity schedules no gc timer, which would hold Jest open.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

afterEach(() => {
  client.clear();
  jest.useRealTimers();
});

describe("useArtistDetails", () => {
  it("reads the artist again until its release stats land, then stops", async () => {
    mockGetArtistDetails
      .mockResolvedValueOnce(details(true))
      .mockResolvedValue(details(false, 5400));

    const { result } = await renderHook(() => useArtistDetails("mbid-1"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.data?.["release-stats-pending"]).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockGetArtistDetails).toHaveBeenCalledTimes(2);
    expect(result.current.data?.["release-groups"][0].listenerCount).toBe(5400);

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(mockGetArtistDetails).toHaveBeenCalledTimes(2);
  });
});
