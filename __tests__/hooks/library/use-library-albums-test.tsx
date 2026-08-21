jest.mock("@/lib/api/library", () => ({
  getLibraryAlbums: jest.fn(),
}));

// The read path is a build-time constant, so the tests swap it through the
// module to cover the canonical branch as well as the shipped legacy one.
let mockReadsCanonical = false;
jest.mock("@/lib/library-read", () => ({
  get READS_CANONICAL() {
    return mockReadsCanonical;
  },
  get LIBRARY_READ() {
    return mockReadsCanonical
      ? { readPath: "canonical", source: "all" }
      : ({} as Record<string, never>);
  },
}));

import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getLibraryAlbums } from "@/lib/api/library";
import { useLibraryAlbums } from "@/hooks/library/use-library-albums";
import type { Album } from "@/lib/types/library";

const mockGetLibraryAlbums = getLibraryAlbums as jest.Mock;

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
  mockReadsCanonical = false;
});

describe("useLibraryAlbums on the legacy read path", () => {
  it("drops unmonitored albums, keeping monitored ones", async () => {
    mockGetLibraryAlbums.mockResolvedValue([
      makeAlbum({ id: "monitored", mbid: "mb-monitored", monitored: true }),
      makeAlbum({ id: "untracked", mbid: "mb-untracked", monitored: false }),
    ]);

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryAlbums("art1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((a) => a.id)).toEqual(["monitored"]);
  });

  it("keeps monitored albums that are still downloading (0%)", async () => {
    mockGetLibraryAlbums.mockResolvedValue([
      makeAlbum({
        id: "downloading",
        monitored: true,
        statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
      }),
    ]);

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryAlbums("art1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((a) => a.id)).toEqual(["downloading"]);
  });
});

describe("useLibraryAlbums on the canonical read path", () => {
  beforeEach(() => {
    mockReadsCanonical = true;
  });

  it("keeps unmonitored albums", async () => {
    // The canonical library returns only albums it found files for, and it
    // leaves monitored false for albums scanned from the Aurral root. The
    // legacy filter would hide every one of them.
    mockGetLibraryAlbums.mockResolvedValue([
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

  it("sends the canonical read path to the API", async () => {
    mockGetLibraryAlbums.mockResolvedValue([]);

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryAlbums("mb-artist"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetLibraryAlbums).toHaveBeenCalledWith("mb-artist", {
      readPath: "canonical",
      source: "all",
    });
  });
});

describe("useLibraryAlbums", () => {
  it("does not fetch when the artist reference is undefined", async () => {
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryAlbums(undefined), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetLibraryAlbums).not.toHaveBeenCalled();
  });
});
