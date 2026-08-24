jest.mock("@/lib/api/library", () => ({
  getCanonicalLibraryPage: jest.fn(),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ serverUrl: "http://server", token: "token" }),
}));

import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { useLibraryArtists } from "@/hooks/library/use-library-artists";
import type { Artist, CanonicalPage } from "@/lib/types/library";

const mockGetCanonicalLibraryPage = getCanonicalLibraryPage as jest.Mock;

function makeArtist(id: string): Artist {
  return {
    id,
    mbid: `mb-${id}`,
    foreignArtistId: `f-${id}`,
    artistName: `Artist ${id}`,
    monitored: true,
    monitorOption: "all",
    addedAt: "2020-01-01T00:00:00.000Z",
    statistics: { albumCount: 0, trackCount: 0, sizeOnDisk: 0 },
  };
}

function makePage(overrides: Partial<CanonicalPage> = {}): CanonicalPage {
  return {
    kind: "artists",
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useLibraryArtists", () => {
  it("drains every page and flattens the artists in page order", async () => {
    mockGetCanonicalLibraryPage.mockImplementation(({ page }) =>
      page === 1
        ? Promise.resolve(
            makePage({
              page: 1,
              total: 2,
              hasMore: true,
              artists: [makeArtist("a1")],
            }),
          )
        : Promise.resolve(
            makePage({ page: 2, total: 2, artists: [makeArtist("a2")] }),
          ),
    );

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryArtists(), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.data?.map((a) => a.id)).toEqual(["a1", "a2"]),
    );
    expect(result.current.hasNextPage).toBe(false);
    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledTimes(2);
    expect(mockGetCanonicalLibraryPage).toHaveBeenNthCalledWith(1, {
      kind: "artists",
      source: "all",
      page: 1,
      pageSize: 100,
    });
    expect(mockGetCanonicalLibraryPage).toHaveBeenNthCalledWith(2, {
      kind: "artists",
      source: "all",
      page: 2,
      pageSize: 100,
    });
  });

  it("stops the drain when a page fails, keeping the pages it has", async () => {
    mockGetCanonicalLibraryPage.mockImplementation(({ page }) =>
      page === 1
        ? Promise.resolve(
            makePage({
              page: 1,
              total: 200,
              hasMore: true,
              artists: [makeArtist("a1")],
            }),
          )
        : Promise.reject(new Error("boom")),
    );

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryArtists(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // One initial page, one failed next page, and no retry loop after the
    // failure — the drain guard must not hammer a failing server.
    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledTimes(2);
    expect(result.current.data?.map((a) => a.id)).toEqual(["a1"]);
  });
});
