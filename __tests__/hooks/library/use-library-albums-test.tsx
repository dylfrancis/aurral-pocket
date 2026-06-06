jest.mock("@/lib/api/library", () => ({
  getLibraryAlbums: jest.fn(),
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
});

describe("useLibraryAlbums", () => {
  it("drops unmonitored albums, keeping monitored ones", async () => {
    mockGetLibraryAlbums.mockResolvedValue([
      makeAlbum({ id: "monitored", mbid: "mb-monitored", monitored: true }),
      makeAlbum({ id: "untracked", mbid: "mb-untracked", monitored: false }),
    ]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useLibraryAlbums("art1"), { wrapper });

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
    const { result } = renderHook(() => useLibraryAlbums("art1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((a) => a.id)).toEqual(["downloading"]);
  });

  it("does not fetch when artistId is undefined", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useLibraryAlbums(undefined), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetLibraryAlbums).not.toHaveBeenCalled();
  });
});
