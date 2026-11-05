jest.mock("@/lib/api/library", () => ({
  getCanonicalLibraryPage: jest.fn(),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ serverUrl: "http://server", token: "token" }),
}));

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { useAlbumGrid } from "@/hooks/library/use-album-grid";
import type { Album, Artist, CanonicalPage } from "@/lib/types/library";

const mockGetCanonicalLibraryPage = getCanonicalLibraryPage as jest.Mock;

function makeAlbum(id: string, overrides: Partial<Album> = {}): Album {
  return {
    id,
    canonicalId: id,
    artistId: "1",
    artistName: "",
    mbid: `mb-album-${id}`,
    foreignAlbumId: `f-${id}`,
    albumName: `Album ${id}`,
    title: `Album ${id}`,
    releaseDate: null,
    monitored: false,
    statistics: {
      trackCount: 10,
      trackFileCount: 10,
      sizeOnDisk: 0,
      percentOfTracks: 100,
    },
    ...overrides,
  };
}

function makeArtist(id: string, overrides: Partial<Artist> = {}): Artist {
  return {
    id,
    mbid: `mb-artist-${id}`,
    foreignArtistId: `f-${id}`,
    artistName: `Artist ${id}`,
    monitored: false,
    monitorOption: "none",
    addedAt: null,
    statistics: { albumCount: 1, trackCount: 10, sizeOnDisk: 0 },
    ...overrides,
  };
}

function makePage(overrides: Partial<CanonicalPage> = {}): CanonicalPage {
  return {
    kind: "albums",
    page: 1,
    pageSize: 100,
    total: 0,
    hasMore: false,
    artists: [],
    albums: [],
    tracks: [],
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

const albumIds = (albums: Album[]) => albums.map((album) => album.id);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useAlbumGrid", () => {
  it("reads one page at a time, and drops an album a later page repeats", async () => {
    mockGetCanonicalLibraryPage.mockImplementation(({ page }) =>
      Promise.resolve(
        page === 1
          ? makePage({
              page: 1,
              total: 3,
              hasMore: true,
              albums: [makeAlbum("a1"), makeAlbum("a2")],
            })
          : makePage({
              page: 2,
              total: 3,
              // The library changed between reads, shifting a2 onto page 2.
              albums: [makeAlbum("a2"), makeAlbum("a3")],
            }),
      ),
    );

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useAlbumGrid(), { wrapper });

    await waitFor(() =>
      expect(albumIds(result.current.items)).toEqual(["a1", "a2"]),
    );
    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledTimes(1);
    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "albums",
        page: 1,
        pageSize: 100,
        sort: "name",
        direction: "asc",
      }),
    );
    expect(mockGetCanonicalLibraryPage.mock.calls[0][0]).not.toHaveProperty(
      "availableOnly",
    );

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() =>
      expect(albumIds(result.current.items)).toEqual(["a1", "a2", "a3"]),
    );
    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledTimes(2);
    expect(mockGetCanonicalLibraryPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it("names each album's library artist from the page, falling back to the album's credit", async () => {
    mockGetCanonicalLibraryPage.mockResolvedValue(
      makePage({
        total: 2,
        artists: [makeArtist("7", { artistName: "Boards of Canada" })],
        albums: [
          makeAlbum("a1", { artistId: "7", artistName: "BoC feat. Someone" }),
          makeAlbum("a2", { artistId: "9", artistName: "Various Artists" }),
        ],
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useAlbumGrid(), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    const [linked, credited] = result.current.items;
    expect(linked.artistName).toBe("Boards of Canada");
    expect(linked.artistMbid).toBe("mb-artist-7");
    expect(credited.artistName).toBe("Various Artists");
    expect(credited.artistMbid).toBeUndefined();
  });

  it("asks for Recently Added newest first, keeping the current albums until they land", async () => {
    let resolveNewest: (page: CanonicalPage) => void = () => {};
    mockGetCanonicalLibraryPage.mockImplementation(({ sort, page }) =>
      sort === "newest"
        ? new Promise<CanonicalPage>((resolve) => {
            resolveNewest = resolve;
          })
        : Promise.resolve(
            makePage({
              page,
              total: 200,
              hasMore: true,
              albums: [makeAlbum("old")],
            }),
          ),
    );

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useAlbumGrid(), { wrapper });
    await waitFor(() =>
      expect(albumIds(result.current.items)).toEqual(["old"]),
    );

    await act(async () => {
      result.current.setSortMode("newest");
    });

    expect(mockGetCanonicalLibraryPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "newest", direction: "asc", page: 1 }),
    );
    expect(albumIds(result.current.items)).toEqual(["old"]);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      resolveNewest(makePage({ total: 1, albums: [makeAlbum("new")] }));
    });
    await waitFor(() =>
      expect(albumIds(result.current.items)).toEqual(["new"]),
    );
  });

  it("searches on the server, and names the search only once its empty result lands", async () => {
    mockGetCanonicalLibraryPage.mockImplementation(({ query }) =>
      Promise.resolve(
        query ? makePage() : makePage({ total: 1, albums: [makeAlbum("a1")] }),
      ),
    );

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useAlbumGrid(), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      result.current.setSearchQuery("  aphex  ");
    });
    // The albums on screen still answer no search at all.
    expect(result.current.settledQuery).toBe("");

    await waitFor(() =>
      expect(mockGetCanonicalLibraryPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: "aphex", page: 1 }),
      ),
    );
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.settledQuery).toBe("aphex");
    expect(result.current.hasUnderlyingItems).toBe(true);
  });
});
