import { renderHook, act } from "@testing-library/react-native";

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
import type { Album, ReleaseGroup } from "@/lib/types/library";

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
  it("returns all items when query is empty", async () => {
    setAlbums([
      makeAlbum("Kid A"),
      makeAlbum("OK Computer"),
      makeAlbum("In Rainbows"),
    ]);

    const { result } = await renderHook(() =>
      useReleaseGrid<Album>(albumConfig),
    );

    expect(result.current.items.map((a) => a.albumName)).toEqual(
      expect.arrayContaining(["Kid A", "OK Computer", "In Rainbows"]),
    );
    expect(result.current.items).toHaveLength(3);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.hasUnderlyingItems).toBe(true);
  });

  it("matches case-insensitive substrings in album name", async () => {
    setAlbums([
      makeAlbum("Kid A"),
      makeAlbum("OK Computer"),
      makeAlbum("In Rainbows"),
    ]);

    const { result } = await renderHook(() =>
      useReleaseGrid<Album>(albumConfig),
    );

    await act(() => result.current.setSearchQuery("computer"));
    expect(result.current.items.map((a) => a.albumName)).toEqual([
      "OK Computer",
    ]);

    await act(() => result.current.setSearchQuery("RAIN"));
    expect(result.current.items.map((a) => a.albumName)).toEqual([
      "In Rainbows",
    ]);
  });

  it("trims whitespace and treats whitespace-only query as empty", async () => {
    setAlbums([makeAlbum("Kid A"), makeAlbum("OK Computer")]);

    const { result } = await renderHook(() =>
      useReleaseGrid<Album>(albumConfig),
    );

    await act(() => result.current.setSearchQuery("   "));
    expect(result.current.items).toHaveLength(2);

    await act(() => result.current.setSearchQuery("  kid  "));
    expect(result.current.items.map((a) => a.albumName)).toEqual(["Kid A"]);
  });

  it("returns empty list when query matches nothing", async () => {
    setAlbums([makeAlbum("Kid A"), makeAlbum("OK Computer")]);

    const { result } = await renderHook(() =>
      useReleaseGrid<Album>(albumConfig),
    );

    await act(() => result.current.setSearchQuery("zzz"));
    expect(result.current.items).toEqual([]);
    expect(result.current.hasUnderlyingItems).toBe(true);
  });

  it("reports hasUnderlyingItems=false when source list is empty", async () => {
    setAlbums([]);

    const { result } = await renderHook(() =>
      useReleaseGrid<Album>(albumConfig),
    );

    expect(result.current.items).toEqual([]);
    expect(result.current.hasUnderlyingItems).toBe(false);
  });

  it("only filters items matching the current albumType", async () => {
    setAlbums([
      makeAlbum("Kid A"),
      { ...makeAlbum("Pyramid Song", "ep1"), albumType: "EP" } as Album,
    ]);

    const { result } = await renderHook(() =>
      useReleaseGrid<Album>(albumConfig),
    );

    expect(result.current.items.map((a) => a.albumName)).toEqual(["Kid A"]);
    expect(result.current.hasUnderlyingItems).toBe(true);

    await act(() => result.current.setSearchQuery("pyramid"));
    expect(result.current.items).toEqual([]);
  });
});

describe("useReleaseGrid owned compilations", () => {
  const studio = makeAlbum("Studio Album", "s1");
  const hits = {
    ...makeAlbum("Greatest Hits", "h1"),
    secondaryTypes: ["Compilation"],
  } as Album;

  it.each([
    ["Album", ["Studio Album"]],
    ["Compilation", ["Greatest Hits"]],
  ])("lists only the %s row's albums", async (albumType, expected) => {
    mockUseLocalSearchParams.mockReturnValue({
      artistMbid: "mbid-1",
      albumType,
    });
    setAlbums([studio, hits]);

    const { result } = await renderHook(() =>
      useReleaseGrid<Album>(albumConfig),
    );

    expect(result.current.items.map((album) => album.albumName)).toEqual(
      expected,
    );
  });
});

describe("useReleaseGrid releases", () => {
  const releaseConfig = {
    variant: "releases" as const,
    getDate: (rg: ReleaseGroup) => rg["first-release-date"],
    getName: (rg: ReleaseGroup) => rg.title,
    supportsMissing: false,
  };

  const studio: ReleaseGroup = {
    id: "studio",
    title: "Studio",
    "first-release-date": "2020-01-01",
    "primary-type": "Album",
    "secondary-types": [],
    listenerCount: 10,
  };
  const hits: ReleaseGroup = {
    id: "hits",
    title: "Hits",
    "first-release-date": "2010-01-01",
    "primary-type": "Album",
    "secondary-types": ["Compilation"],
    listenerCount: 90,
  };

  const classic: ReleaseGroup = {
    ...studio,
    id: "classic",
    title: "Classic",
    "first-release-date": "1997-01-01",
    listenerCount: 50,
  };

  function openRow(albumType: string) {
    mockUseLocalSearchParams.mockReturnValue({
      artistMbid: "mbid-1",
      albumType,
    });
    mockUseLibraryAlbums.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    mockUseAlbumsWithTypes.mockReturnValue({
      albums: [],
      otherReleases: [classic, studio, hits],
      isLoadingTypes: false,
    });
    return renderHook(() => useReleaseGrid<ReleaseGroup>(releaseConfig));
  }

  const titles = (items: ReleaseGroup[]) => items.map((rg) => rg.title);

  it.each([
    ["Album", ["Studio", "Classic"]],
    ["Compilation", ["Hits"]],
  ])(
    "lists the %s row's releases, newest first",
    async (albumType, expected) => {
      const { result } = await openRow(albumType);

      expect(titles(result.current.items)).toEqual(expected);
    },
  );
});
