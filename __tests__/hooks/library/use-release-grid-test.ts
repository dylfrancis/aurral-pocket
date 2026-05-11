import { renderHook, act } from "@testing-library/react-native";

jest.mock("@/components/library/AlbumSortPicker", () => {
  const sortOptions = [
    { key: "date-desc", label: "Newest", iosIcon: "" },
    { key: "date-asc", label: "Oldest", iosIcon: "" },
    { key: "name-asc", label: "Name A-Z", iosIcon: "" },
    { key: "name-desc", label: "Name Z-A", iosIcon: "" },
    { key: "missing", label: "Missing", iosIcon: "" },
  ];
  return {
    ALBUM_SORT_OPTIONS: sortOptions,
    AlbumSortTrigger: () => null,
    AlbumSortSheet: () => null,
  };
});

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
}));

jest.mock("@/hooks/library/use-library-albums", () => ({
  useLibraryAlbums: jest.fn(),
}));

jest.mock("@/hooks/library/use-albums-with-types", () => ({
  useAlbumsWithTypes: jest.fn(),
}));

import { useLocalSearchParams } from "expo-router";
import { useLibraryAlbums } from "@/hooks/library/use-library-albums";
import { useAlbumsWithTypes } from "@/hooks/library/use-albums-with-types";
import { useReleaseGrid } from "@/hooks/library/use-release-grid";
import type { Album } from "@/lib/types/library";

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseLibraryAlbums = useLibraryAlbums as jest.Mock;
const mockUseAlbumsWithTypes = useAlbumsWithTypes as jest.Mock;

const albumConfig = {
  variant: "albums" as const,
  getDate: (a: Album) => a.releaseDate,
  getName: (a: Album) => a.albumName,
  supportsMissing: true,
  isMissing: () => false,
};

function makeAlbum(name: string, id = name): Album {
  return {
    id,
    artistId: "artist-1",
    artistName: "Artist",
    mbid: `mbid-${id}`,
    foreignAlbumId: `fid-${id}`,
    albumName: name,
    title: name,
    releaseDate: "2024-01-01",
    monitored: true,
    albumType: "Album",
    secondaryTypes: [],
    statistics: {
      trackCount: 10,
      trackFileCount: 10,
      percentOfTracks: 100,
      sizeOnDisk: 1000,
    },
  } as unknown as Album;
}

function setAlbums(albums: Album[]) {
  mockUseLibraryAlbums.mockReturnValue({
    data: albums,
    isLoading: false,
    refetch: jest.fn(),
  });
  mockUseAlbumsWithTypes.mockReturnValue({
    albums,
    otherReleases: [],
    isLoadingTypes: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({
    artistId: "artist-1",
    artistMbid: "mbid-1",
    albumType: "Album",
    artistName: "Artist",
  });
});

describe("useReleaseGrid search filter", () => {
  it("returns all items when query is empty", () => {
    setAlbums([
      makeAlbum("Kid A"),
      makeAlbum("OK Computer"),
      makeAlbum("In Rainbows"),
    ]);

    const { result } = renderHook(() => useReleaseGrid<Album>(albumConfig));

    expect(result.current.items.map((a) => a.albumName)).toEqual(
      expect.arrayContaining(["Kid A", "OK Computer", "In Rainbows"]),
    );
    expect(result.current.items).toHaveLength(3);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.hasUnderlyingItems).toBe(true);
  });

  it("matches case-insensitive substrings in album name", () => {
    setAlbums([
      makeAlbum("Kid A"),
      makeAlbum("OK Computer"),
      makeAlbum("In Rainbows"),
    ]);

    const { result } = renderHook(() => useReleaseGrid<Album>(albumConfig));

    act(() => result.current.setSearchQuery("computer"));
    expect(result.current.items.map((a) => a.albumName)).toEqual([
      "OK Computer",
    ]);

    act(() => result.current.setSearchQuery("RAIN"));
    expect(result.current.items.map((a) => a.albumName)).toEqual([
      "In Rainbows",
    ]);
  });

  it("trims whitespace and treats whitespace-only query as empty", () => {
    setAlbums([makeAlbum("Kid A"), makeAlbum("OK Computer")]);

    const { result } = renderHook(() => useReleaseGrid<Album>(albumConfig));

    act(() => result.current.setSearchQuery("   "));
    expect(result.current.items).toHaveLength(2);

    act(() => result.current.setSearchQuery("  kid  "));
    expect(result.current.items.map((a) => a.albumName)).toEqual(["Kid A"]);
  });

  it("returns empty list when query matches nothing", () => {
    setAlbums([makeAlbum("Kid A"), makeAlbum("OK Computer")]);

    const { result } = renderHook(() => useReleaseGrid<Album>(albumConfig));

    act(() => result.current.setSearchQuery("zzz"));
    expect(result.current.items).toEqual([]);
    expect(result.current.hasUnderlyingItems).toBe(true);
  });

  it("reports hasUnderlyingItems=false when source list is empty", () => {
    setAlbums([]);

    const { result } = renderHook(() => useReleaseGrid<Album>(albumConfig));

    expect(result.current.items).toEqual([]);
    expect(result.current.hasUnderlyingItems).toBe(false);
  });

  it("only filters items matching the current albumType", () => {
    setAlbums([
      makeAlbum("Kid A"),
      { ...makeAlbum("Pyramid Song", "ep1"), albumType: "EP" } as Album,
    ]);

    const { result } = renderHook(() => useReleaseGrid<Album>(albumConfig));

    expect(result.current.items.map((a) => a.albumName)).toEqual(["Kid A"]);
    expect(result.current.hasUnderlyingItems).toBe(true);

    act(() => result.current.setSearchQuery("pyramid"));
    expect(result.current.items).toEqual([]);
  });
});
