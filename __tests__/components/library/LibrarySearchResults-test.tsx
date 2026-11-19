jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

// Reanimated can't load under Jest; no test here reaches the loading rows.
jest.mock("@/components/search/SkeletonRows", () => ({
  SkeletonRows: () => null,
}));

jest.mock("@/components/library/TrackActionsSheet", () => ({
  TrackActionsSheet: () => null,
}));

jest.mock("@/hooks/search/use-search-song-actions", () => ({
  useSearchSongActions: () => ({
    play: jest.fn(),
    openActions: jest.fn(),
    actionsTarget: null,
    closeActions: jest.fn(),
  }),
}));

jest.mock("@/hooks/search/use-library-search", () => ({
  useLibrarySearch: jest.fn(),
}));

jest.mock("@/lib/offline/network", () => ({
  useIsOffline: jest.fn(() => false),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { LibrarySearchResults } from "@/components/library/LibrarySearchResults";
import { useLibrarySearch } from "@/hooks/search/use-library-search";
import { useIsOffline } from "@/lib/offline/network";
import type {
  LibrarySearchAlbum,
  LibrarySearchArtist,
} from "@/lib/types/search";

const mockUseLibrarySearch = useLibrarySearch as jest.Mock;
const mockUseIsOffline = useIsOffline as jest.Mock;

function album(index: number): LibrarySearchAlbum {
  return {
    id: `rg-${index}`,
    libraryId: `lib-${index}`,
    title: `Radio Album ${index}`,
    artistName: "Radiohead",
    artistMbid: "artist-mbid",
    releaseDate: "1997-05-21",
    coverUrl: null,
  };
}

function answer(
  albums: LibrarySearchAlbum[],
  { query = "radio", artists = [] as LibrarySearchArtist[] } = {},
) {
  return {
    data: { query, artists, albums, tracks: [], playlists: [] },
    isPlaceholderData: false,
    isError: false,
    refetch: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseIsOffline.mockReturnValue(false);
});

describe("LibrarySearchResults", () => {
  it("shows four of a kind until See all expands it, and a new search starts collapsed", async () => {
    mockUseLibrarySearch.mockReturnValue(answer([1, 2, 3, 4, 5].map(album)));
    const { rerender } = await render(<LibrarySearchResults query="radio" />);

    expect(screen.queryByText("Radio Album 5")).toBeNull();
    await fireEvent.press(screen.getByText("See all albums"));
    expect(screen.getByText("Radio Album 5")).toBeTruthy();
    expect(screen.queryByText("See all albums")).toBeNull();

    mockUseLibrarySearch.mockReturnValue(
      answer([1, 2, 3, 4, 5].map(album), { query: "radio a" }),
    );
    await rerender(<LibrarySearchResults query="radio a" />);
    expect(screen.queryByText("Radio Album 5")).toBeNull();
    expect(screen.getByText("See all albums")).toBeTruthy();
  });

  it("opens an album by its Library id, which its tracks are read by", async () => {
    mockUseLibrarySearch.mockReturnValue(answer([album(1)]));
    await render(<LibrarySearchResults query="radio" />);

    await fireEvent.press(screen.getByText("Radio Album 1"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/album/[ref]",
      params: expect.objectContaining({
        ref: "lib-1",
        libraryAlbumId: "lib-1",
        albumMbid: "rg-1",
        artistMbid: "artist-mbid",
      }),
    });
  });

  it("leaves out an artist with no MBID, whose page would not open", async () => {
    const artist = (name: string, hasMbid: boolean) => ({
      id: hasMbid ? `mbid-${name}` : `lib-${name}`,
      libraryId: `lib-${name}`,
      hasMbid,
      name,
      image: null,
    });
    mockUseLibrarySearch.mockReturnValue(
      answer([album(1)], {
        artists: [artist("Tagged", true), artist("Untagged", false)],
      }),
    );
    await render(<LibrarySearchResults query="radio" />);

    expect(screen.getByText("Tagged")).toBeTruthy();
    expect(screen.queryByText("Untagged")).toBeNull();
    expect(screen.getByText("Radio Album 1")).toBeTruthy();
  });

  it("won't open a result of the last search while the next one loads", async () => {
    mockUseLibrarySearch.mockReturnValue(answer([album(1)], { query: "rad" }));
    await render(<LibrarySearchResults query="radio" />);

    await fireEvent.press(screen.getByText("Radio Album 1"));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("offline, points to the saved music instead of failing a search", async () => {
    mockUseIsOffline.mockReturnValue(true);
    mockUseLibrarySearch.mockReturnValue({
      data: undefined,
      isPlaceholderData: false,
      isError: true,
      refetch: jest.fn(),
    });
    await render(<LibrarySearchResults query="radio" />);

    expect(
      screen.getByText("Searching your Library needs a connection"),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Open Offline"));
    expect(mockPush).toHaveBeenCalledWith("/offline");
  });
});
