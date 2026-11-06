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
