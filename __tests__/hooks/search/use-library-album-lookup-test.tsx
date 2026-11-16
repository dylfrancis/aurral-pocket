jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    serverUrl: "https://aurral.example",
    token: "test-token",
  }),
}));

jest.mock("@/lib/api/library", () => ({
  lookupLibraryAlbums: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useNavigation: () => ({ isFocused: () => true }),
}));

import React from "react";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLibraryAlbumLookup } from "@/hooks/search/use-library-album-lookup";
import { lookupLibraryAlbums } from "@/lib/api/library";
import type { AlbumLookupBatch } from "@/lib/types/library";
import type { SearchAlbum } from "@/lib/types/search";

const mockLookupLibraryAlbums = lookupLibraryAlbums as jest.Mock;

function searchAlbum(id: string, title: string): SearchAlbum {
  return {
    type: "album",
    id,
    title,
    artistName: "Radiohead",
    artistMbid: "artist-mbid",
    releaseDate: "2000-10-02",
    primaryType: "Album",
    secondaryTypes: [],
    coverUrl: null,
  };
}

const kidA = searchAlbum("rg-kid-a", "Kid A");
const amnesiac = searchAlbum("rg-amnesiac", "Amnesiac");
const okComputer = searchAlbum("rg-ok-computer", "OK Computer");

const LOOKUP: AlbumLookupBatch = {
  "rg-kid-a": {
    libraryAlbumId: "41",
    libraryArtistId: "7",
    status: "available",
  },
  "rg-amnesiac": {
    libraryAlbumId: "42",
    libraryArtistId: "7",
    status: "partial",
  },
};

let client: QueryClient;

async function renderLookup(albums: SearchAlbum[]) {
  return renderHook(() => useLibraryAlbumLookup(albums), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
});

afterEach(() => {
  cleanup();
  client.clear();
});

describe("useLibraryAlbumLookup", () => {
  it("marks each album by what the Library holds of it", async () => {
    mockLookupLibraryAlbums.mockResolvedValue(LOOKUP);

    const { result } = await renderLookup([kidA, amnesiac, okComputer]);

    await waitFor(() =>
      expect(result.current.statusFor(kidA)).toBe("available"),
    );
    // Missing tracks, or none downloaded yet, is still the Library's album.
    expect(result.current.statusFor(amnesiac)).toBe("inLibrary");
    expect(result.current.statusFor(okComputer)).toBe("missing");
  });

  it("opens a Library album on its Library page, waiting for a lookup still on its way", async () => {
    let answer!: (batch: AlbumLookupBatch) => void;
    mockLookupLibraryAlbums.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = await renderLookup([kidA, okComputer]);

    const opened = result.current.openAlbum(kidA);
    expect(mockPush).not.toHaveBeenCalled();

    await act(async () => {
      answer(LOOKUP);
      await opened;
    });

    expect(mockLookupLibraryAlbums).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/album/[ref]",
      params: expect.objectContaining({
        ref: "41",
        canonicalAlbumId: "41",
        artistId: "7",
        albumMbid: "rg-kid-a",
        title: "Kid A",
        artistName: "Radiohead",
        artistMbid: "artist-mbid",
      }),
    });
  });

  it("opens the release page for an album the Library doesn't have", async () => {
    mockLookupLibraryAlbums.mockResolvedValue(LOOKUP);
    const { result } = await renderLookup([kidA, okComputer]);

    await act(() => result.current.openAlbum(okComputer));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/release/[mbid]",
      params: expect.objectContaining({
        mbid: "rg-ok-computer",
        title: "OK Computer",
        artistMbid: "artist-mbid",
        // The page looks the artist up and offers the add.
        artistId: "",
        status: "",
      }),
    });
  });
});
