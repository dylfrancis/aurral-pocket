jest.mock("@/lib/api/library", () => ({
  getCanonicalAlbumTracks: jest.fn(),
}));

import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCanonicalAlbumTracks } from "@/lib/api/library";
import { useLibraryTracks } from "@/hooks/library/use-library-tracks";
import type { Track } from "@/lib/types/library";

const mockGetCanonicalAlbumTracks = getCanonicalAlbumTracks as jest.Mock;

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "t1",
    mbid: "mb-t1",
    trackName: "Track",
    title: "Track",
    trackNumber: 1,
    hasFile: true,
    size: 1,
    quality: "FLAC",
    ...overrides,
  };
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { wrapper: Wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useLibraryTracks", () => {
  it("reads the paged canonical route by canonical album id", async () => {
    const owned = makeTrack({
      id: "31",
      streamPath: "/library/canonical-stream/12/31",
    });
    const wanted = makeTrack({
      id: "32",
      hasFile: false,
      streamPath: null,
    });
    mockGetCanonicalAlbumTracks.mockResolvedValue([owned, wanted]);

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryTracks("12"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetCanonicalAlbumTracks).toHaveBeenCalledWith("12");
    // Wanted tracks stay in the list — the screen shows the missing marker.
    expect(result.current.data?.map((t) => t.id)).toEqual(["31", "32"]);
  });

  it("does not fetch when the album reference is undefined", async () => {
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryTracks(undefined), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetCanonicalAlbumTracks).not.toHaveBeenCalled();
  });
});
