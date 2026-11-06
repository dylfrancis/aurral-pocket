jest.mock("@/lib/api/library", () => ({
  getCanonicalGenres: jest.fn(),
  getCanonicalLibraryPage: jest.fn(),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ serverUrl: "http://server", token: "token" }),
}));

jest.mock("@/components/player/MiniPlayerHost", () => ({
  MiniPlayerHost: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@shopify/flash-list", () => {
  const { FlatList } = require("react-native");
  return { FlashList: FlatList };
});

import React from "react";
import { Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from "expo-router/testing-library";
import LibraryLayout from "@/app/(app)/(tabs)/(library)/_layout";
import GenreDetailRoute from "@/app/(app)/(tabs)/(library)/genre/[genre]";
import LibraryGenresScreen from "@/app/(app)/(tabs)/(library)/genres";
import { getCanonicalGenres, getCanonicalLibraryPage } from "@/lib/api/library";
import type { Album, CanonicalGenre, CanonicalPage } from "@/lib/types/library";

const mockGetCanonicalGenres = getCanonicalGenres as jest.Mock;
const mockGetCanonicalLibraryPage = getCanonicalLibraryPage as jest.Mock;

function makeGenre(name: string, counts: Partial<CanonicalGenre> = {}) {
  return { name, artists: 2, albums: 3, tracks: 30, ...counts };
}

function makeAlbumPage(albums: Partial<Album>[] = []): CanonicalPage {
  return {
    kind: "albums",
    page: 1,
    pageSize: 100,
    total: albums.length,
    hasMore: false,
    artists: [],
    albums: albums as Album[],
    tracks: [],
  };
}

const OtherRoute = () => null;

async function openGenresList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return renderRouter(
    {
      _layout: LibraryLayout,
      genres: LibraryGenresScreen,
      "genre/[genre]": GenreDetailRoute,
      "album/[ref]": () => <Text>The album page</Text>,
      // The layout's other screens, so it finds every route it names.
      index: OtherRoute,
      artists: OtherRoute,
      albums: OtherRoute,
      blocklist: OtherRoute,
      "artist/[mbid]": OtherRoute,
      "artist/albums": OtherRoute,
      "artist/releases": OtherRoute,
      "release/[mbid]": OtherRoute,
    },
    {
      initialUrl: "/genres",
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
}

// The native header and search bar render no text a query could find.
const nativeElements = (type: string) =>
  screen.container.queryAll((node) => node.type === type);

async function search(text: string) {
  const [searchBar] = nativeElements("RNSSearchBar");
  await act(async () => {
    searchBar.props.onChangeText({ nativeEvent: { text } });
  });
}

const sortMenuItems = () => {
  const [header] = nativeElements("RNSScreenStackHeaderConfig");
  return header.props.headerRightBarButtonItems[0].menu.items as {
    title: string;
    state: "on" | "off";
    menuId: string;
  }[];
};

// Fires the event the native header sends when a menu item is tapped.
async function chooseSort(title: string) {
  const { menuId } = sortMenuItems().find((item) => item.title === title)!;
  const [header] = nativeElements("RNSScreenStackHeaderConfig");
  await act(async () => {
    header.props.onPressHeaderBarButtonMenuItem({ nativeEvent: { menuId } });
  });
}

const genreRows = () =>
  screen.getAllByText(/^(Ambient|Jazz|Rock)$/).map((row) => row.props.children);

beforeEach(() => {
  mockGetCanonicalGenres.mockReset();
  mockGetCanonicalLibraryPage.mockReset();
  mockGetCanonicalLibraryPage.mockResolvedValue(makeAlbumPage());
});

describe("genres list", () => {
  it("lists the genres by name, each with its counts", async () => {
    mockGetCanonicalGenres.mockResolvedValue([
      makeGenre("rock", { artists: 12, albums: 40, tracks: 512 }),
      makeGenre("Ambient", { artists: 1, albums: 1, tracks: 1 }),
      makeGenre("Jazz", { artists: 0, albums: 0, tracks: 2 }),
    ]);
    await openGenresList();

    expect(await screen.findByText("rock")).toBeTruthy();
    expect(
      screen.getByText("12 artists · 40 albums · 512 tracks"),
    ).toBeTruthy();
    expect(screen.getByText("1 artist · 1 album · 1 track")).toBeTruthy();
    expect(
      screen
        .getAllByText(/^(rock|Ambient|Jazz)$/)
        .map((row) => row.props.children),
    ).toEqual(["Ambient", "Jazz", "rock"]);
  });

  it("searches the loaded genres, ignoring case, without a new request", async () => {
    mockGetCanonicalGenres.mockResolvedValue([
      makeGenre("Hard Rock"),
      makeGenre("Jazz"),
    ]);
    await openGenresList();
    await screen.findByText("Jazz");

    await search(" ROCK ");

    expect(screen.getByText("Hard Rock")).toBeTruthy();
    expect(screen.queryByText("Jazz")).toBeNull();
    expect(mockGetCanonicalGenres).toHaveBeenCalledTimes(1);
  });

  it("tells an empty library from a search with no matches", async () => {
    mockGetCanonicalGenres.mockResolvedValue([makeGenre("Jazz")]);
    await openGenresList();
    await screen.findByText("Jazz");

    await search("polka");

    expect(screen.getByText("No results matching “polka”")).toBeTruthy();
    expect(screen.queryByText("No genres to show")).toBeNull();
  });

  it("says so when the library has no genres", async () => {
    mockGetCanonicalGenres.mockResolvedValue([]);
    await openGenresList();

    expect(await screen.findByText("No genres to show")).toBeTruthy();
  });
});

describe("genres list sorting", () => {
  const genres = [
    makeGenre("Rock", { artists: 3, albums: 4, tracks: 50 }),
    makeGenre("Jazz", { artists: 5, albums: 2, tracks: 20 }),
    makeGenre("Ambient", { artists: 1, albums: 9, tracks: 20 }),
  ];

  it.each([
    ["Name Z-A", ["Rock", "Jazz", "Ambient"]],
    // Ambient and Jazz tie on tracks, so the name decides.
    ["Most Tracks", ["Rock", "Ambient", "Jazz"]],
    ["Most Albums", ["Ambient", "Rock", "Jazz"]],
    ["Most Artists", ["Jazz", "Rock", "Ambient"]],
  ])("orders the rows by %s and marks it chosen", async (title, order) => {
    mockGetCanonicalGenres.mockResolvedValue(genres);
    await openGenresList();
    await screen.findByText("Jazz");
    expect(genreRows()).toEqual(["Ambient", "Jazz", "Rock"]);

    await chooseSort(title);

    expect(genreRows()).toEqual(order);
    expect(
      sortMenuItems()
        .filter((item) => item.state === "on")
        .map((item) => item.title),
    ).toEqual([title]);
  });

  it("offers no grid or list choice, because genres have no artwork", async () => {
    mockGetCanonicalGenres.mockResolvedValue(genres);
    await openGenresList();
    await screen.findByText("Jazz");

    expect(sortMenuItems().map((item) => item.title)).not.toContain("View");
  });

  // A header rebuild can drop the Android search icon.
  it("keeps the native header untouched across a keystroke", async () => {
    mockGetCanonicalGenres.mockResolvedValue(genres);
    await openGenresList();
    await screen.findByText("Jazz");
    const nativeHeaderProps = () => ({
      menu: nativeElements("RNSScreenStackHeaderConfig")[0].props
        .headerRightBarButtonItems,
      onChangeText: nativeElements("RNSSearchBar")[0].props.onChangeText,
    });
    const before = nativeHeaderProps();

    await search("a");

    expect(nativeHeaderProps().menu).toBe(before.menu);
    expect(nativeHeaderProps().onChangeText).toBe(before.onChangeText);
  });

  it("keeps the chosen order while searching", async () => {
    mockGetCanonicalGenres.mockResolvedValue(genres);
    await openGenresList();
    await screen.findByText("Jazz");

    await chooseSort("Name Z-A");
    await search("a");

    expect(genreRows()).toEqual(["Jazz", "Ambient"]);
  });
});

describe("genre detail", () => {
  it.each(["Rock/Pop", "R&B", "AC/DC & Friends", "100% Rock"])(
    "opens %s, titled by its name and listing its albums",
    async (name) => {
      mockGetCanonicalGenres.mockResolvedValue([makeGenre(name)]);
      await openGenresList();

      await fireEvent.press(await screen.findByText(name));

      await waitFor(() => {
        expect(mockGetCanonicalLibraryPage).toHaveBeenCalledWith(
          expect.objectContaining({ kind: "albums", genre: name }),
        );
      });
      expect(
        nativeElements("RNSScreenStackHeaderConfig").map(
          (header) => header.props.title,
        ),
      ).toContain(name);
    },
  );

  it("keeps the grid or list choice, because albums have artwork", async () => {
    mockGetCanonicalGenres.mockResolvedValue([makeGenre("Jazz")]);
    await openGenresList();

    await fireEvent.press(await screen.findByText("Jazz"));

    await waitFor(() => {
      const detailHeader = nativeElements("RNSScreenStackHeaderConfig").at(-1)!;
      expect(
        detailHeader.props.headerRightBarButtonItems[0].menu.items.map(
          (item: { title: string }) => item.title,
        ),
      ).toContain("View");
    });
  });

  it("pushes the album page when an album is tapped", async () => {
    mockGetCanonicalGenres.mockResolvedValue([makeGenre("Jazz")]);
    mockGetCanonicalLibraryPage.mockResolvedValue(
      makeAlbumPage([
        {
          id: "7",
          canonicalId: "7",
          artistId: "1",
          artistName: "Miles Davis",
          albumName: "Kind of Blue",
          title: "Kind of Blue",
          statistics: {
            trackCount: 5,
            trackFileCount: 5,
            sizeOnDisk: 0,
            percentOfTracks: 100,
          },
        },
      ]),
    );
    await openGenresList();

    await fireEvent.press(await screen.findByText("Jazz"));
    await fireEvent.press(await screen.findByText("Kind of Blue"));

    expect(await screen.findByText("The album page")).toBeTruthy();
  });
});
