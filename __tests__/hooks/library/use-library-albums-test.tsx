jest.mock("@/lib/api/library", () => ({
  getCanonicalArtistAlbums: jest.fn(),
}));

import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCanonicalArtistAlbums } from "@/lib/api/library";
import { useLibraryAlbums } from "@/hooks/library/use-library-albums";
import type { Album } from "@/lib/types/library";

const mockGetCanonicalArtistAlbums = getCanonicalArtistAlbums as jest.Mock;

function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: "a1",
    artistId: "art1",
    artistName: "Artist",
    mbid: "mb1",
    foreignAlbumId: "f1",
    albumName: "Album",
    title: "Album",
    releaseDate: "2020-01-01",
    monitored: true,
    statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
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

describe("useLibraryAlbums", () => {
  it("keeps unmonitored albums", async () => {
    // The canonical library leaves monitored false for albums scanned from
    // the Aurral root. A monitored filter would hide every one of them.
    mockGetCanonicalArtistAlbums.mockResolvedValue([
      makeAlbum({ id: "from-lidarr", mbid: "mb-lidarr", monitored: true }),
      makeAlbum({ id: "from-aurral", mbid: "mb-aurral", monitored: false }),
    ]);

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryAlbums("mb-artist"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((a) => a.id)).toEqual([
      "from-lidarr",
      "from-aurral",
    ]);
  });

  it("keeps a monitored album that has no files yet", async () => {
    // A wanted album that is still downloading must stay visible at 0%.
    mockGetCanonicalArtistAlbums.mockResolvedValue([
      makeAlbum({
        id: "wanted",
        monitored: true,
        available: false,
        statistics: { trackCount: 8, sizeOnDisk: 0, percentOfTracks: 0 },
      }),
    ]);

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryAlbums("mb-artist"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((a) => a.id)).toEqual(["wanted"]);
  });

  it("reads the paged canonical route by artist reference", async () => {
    mockGetCanonicalArtistAlbums.mockResolvedValue([]);

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryAlbums("mb-artist"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetCanonicalArtistAlbums).toHaveBeenCalledWith("mb-artist");
  });

  it("does not fetch when the artist reference is undefined", async () => {
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryAlbums(undefined), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetCanonicalArtistAlbums).not.toHaveBeenCalled();
  });
});
