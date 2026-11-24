jest.mock("@/lib/api/client", () => ({
  ...jest.requireActual("@/lib/api/client"),
  api: { get: jest.fn(), post: jest.fn() },
}));

let mockOffline = false;
jest.mock("@/lib/offline/network", () => ({
  ...jest.requireActual("@/lib/offline/network"),
  isOffline: () => mockOffline,
  useIsOffline: () => mockOffline,
}));

jest.mock("@/lib/player/player", () => ({
  playAlbumFromTrack: jest.fn(() => Promise.resolve(true)),
  playQueueFrom: jest.fn(() => Promise.resolve(true)),
  playNextInQueue: jest.fn(),
  addToQueue: jest.fn(),
  setShuffle: jest.fn(),
}));

jest.mock("@/hooks/library/use-library-view", () =>
  require("@/test-support/library-view"),
);

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => () => false,
}));

jest.mock("@/components/player/MiniPlayerHost", () => ({
  MiniPlayerHost: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@shopify/flash-list", () => {
  const { FlatList } = require("react-native");
  return { FlashList: FlatList };
});

jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

// The home's album rails draw Reanimated skeletons, which renderRouter's mock
// can't run. No test here reads them.
jest.mock("@/components/library/LibraryAlbumRail", () => ({
  LibraryAlbumRail: () => null,
}));

jest.mock("@/components/flow/AddToPlaylistSheet", () => ({
  AddToPlaylistSheet: () => null,
  useAddToPlaylist: () => ({
    canAddToPlaylist: false,
    track: null,
    open: jest.fn(),
    close: jest.fn(),
  }),
}));

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
import * as Burnt from "burnt";
import { IS_IOS } from "@/constants/platform";
import LibraryLayout from "@/app/(app)/(tabs)/(library)/_layout";
import LibraryFavoritesScreen, {
  ErrorBoundary,
} from "@/app/(app)/(tabs)/(library)/favorites";
import LibraryHome from "@/app/(app)/(tabs)/(library)/index";
import ArtistFavoritesScreen from "@/app/(app)/(tabs)/(library)/artist/favorites";
import { api, setAuthToken, setBaseUrl } from "@/lib/api/client";
import { playAlbumFromTrack, playQueueFrom } from "@/lib/player/player";
import {
  applyFavorites,
  forgetSavedLibrary,
  setFavoritesSave,
  setSavedLibraryUser,
} from "@/lib/offline/saved-library";
import { libraryKeys } from "@/lib/query-keys";
import type {
  Album,
  AlbumTrack,
  LibraryAlbumsParams,
} from "@/lib/types/library";
import { resetFileSystem } from "@/test-support/expo-file-system";

const mockGet = api.get as jest.Mock;
const mockPost = api.post as jest.Mock;
const mockPlayAlbumFromTrack = playAlbumFromTrack as jest.Mock;

// Raw Library rows, as GET /library sends them to a signed-in user.
const SIGUR_ROS = {
  id: 1,
  name: "Sigur Ros",
  identityKey: "mbid:sigur-ros",
  mbid: "sigur-ros",
  userFavorite: true,
};
const TEST_ARTIST = {
  id: 3,
  name: "Test Artist",
  identityKey: "mbid:test-artist",
  mbid: "test-artist",
  userFavorite: false,
};
const FIRST_ALBUM = {
  id: 4,
  artistId: 3,
  title: "First Album",
  identityKey: "release-group:first-album",
  coverUrl: "/api/library/albums/4/cover",
  mbid: "first-album",
  userFavorite: false,
};
const SECOND_ALBUM = {
  id: 8,
  artistId: 3,
  title: "Second Album",
  identityKey: "release-group:second-album",
  userFavorite: true,
};

function song(id: number, title: string, artistName = "Test Artist") {
  return {
    id,
    title,
    artistName,
    identityKey: `recording:${title.toLowerCase().replace(/ /g, "-")}`,
    albums: [{ albumId: 4, trackNumber: 1 }],
    files: [{ id, albumId: 4, available: true }],
    userFavorite: true,
  };
}

type Kind = "artists" | "albums" | "tracks";
type Rows = { artists?: object[]; albums?: object[]; tracks?: object[] };

/** One page of a section, with the rows its items name. */
function libraryPage(
  kind: Kind,
  rows: Rows = {},
  { page = 1, total = rows[kind]?.length ?? 0 } = {},
) {
  return {
    kind,
    page,
    pageSize: 100,
    total,
    hasMore: page * 100 < total,
    artists: [],
    albums: [],
    tracks: [],
    ...rows,
  };
}

const FAVORITE_PAGES: Record<Kind, ReturnType<typeof libraryPage>> = {
  artists: libraryPage("artists", { artists: [SIGUR_ROS] }),
  albums: libraryPage("albums", {
    albums: [SECOND_ALBUM],
    artists: [TEST_ARTIST],
  }),
  tracks: libraryPage("tracks", {
    tracks: [song(30, "First Song")],
    albums: [FIRST_ALBUM],
    artists: [TEST_ARTIST],
  }),
};

type Params = Record<string, string>;

/** Answer each section's favorites read with `pages`, by kind and page. */
function answerFavorites(
  pages: Partial<Record<Kind, ReturnType<typeof libraryPage>[]>> = {},
) {
  mockGet.mockImplementation((url: string, config?: { params?: Params }) => {
    const params = config?.params ?? {};
    const kind = params.kind as Kind;
    if (url !== "/library") return Promise.resolve({ data: {} });
    if (params.favorite !== "true") {
      return Promise.resolve({ data: libraryPage(kind) });
    }
    const sectionPages = pages[kind] ?? [FAVORITE_PAGES[kind]];
    const page =
      sectionPages[Number(params.page) - 1] ??
      libraryPage(kind, {}, { page: Number(params.page) });
    return Promise.resolve({ data: page });
  });
}

const favoriteReads = () =>
  mockGet.mock.calls
    .filter(
      ([url, config]) =>
        url === "/library" && config?.params?.favorite === "true",
    )
    .map(([, config]) => config.params as Params);

// The native header and search bar render no text a query could find.
const nativeElements = (type: string) =>
  screen.container.queryAll((node) => node.type === type);

const androidMenuNodes = () =>
  screen.container.queryAll((node) => !!node.props.onItemPressed);

type HeaderMenuItem = { title: string; isOn: boolean; press: () => void };

// iOS hands the menu to the native header as data, and Android renders it as
// Compose views. press() is what a real tap on the item fires on each.
function headerMenuItems(): HeaderMenuItem[] {
  if (!IS_IOS) {
    return androidMenuNodes().map((item) => ({
      title: item.queryAll((node) => typeof node.props.text === "string")[0]
        .props.text,
      isOn: item.props.selected === true,
      press: () => item.props.onItemPressed({ nativeEvent: {} }),
    }));
  }
  type IosMenuItem = {
    title: string;
    state?: "on" | "off";
    menuId: string;
    items?: IosMenuItem[];
  };
  const flattenMenu = (items: IosMenuItem[] = []): IosMenuItem[] =>
    items.flatMap((item) => (item.items ? flattenMenu(item.items) : [item]));
  return nativeElements("RNSScreenStackHeaderConfig").flatMap((header) =>
    flattenMenu(header.props.headerRightBarButtonItems?.[0]?.menu.items).map(
      (item) => ({
        title: item.title,
        isOn: item.state === "on",
        press: () =>
          header.props.onPressHeaderBarButtonMenuItem({
            nativeEvent: { menuId: item.menuId },
          }),
      }),
    ),
  );
}

type MenuData = { title?: string; items?: MenuData[]; menu?: MenuData };
const menuTitles = (items: MenuData[] = []): string[] =>
  items.flatMap((item) => [
    ...(item.title ? [item.title] : []),
    ...menuTitles(item.menu?.items ?? item.items),
  ]);

// Every header menu's titles: headerMenuItems reads only the first on iOS.
function allHeaderMenuTitles(): string[] {
  if (!IS_IOS) return headerMenuItems().map((item) => item.title);
  return nativeElements("RNSScreenStackHeaderConfig").flatMap((header) =>
    menuTitles(header.props.headerRightBarButtonItems),
  );
}

async function chooseSort(title: string) {
  const { press } = headerMenuItems().find((item) => item.title === title)!;
  await act(async () => press());
}

const OtherRoute = () => null;

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

async function openFavorites(initialUrl = "/favorites", client = makeClient()) {
  await renderRouter(
    {
      _layout: LibraryLayout,
      favorites: {
        default: LibraryFavoritesScreen,
        ErrorBoundary,
      },
      index: LibraryHome,
      "album/[ref]": () => <Text>The album page</Text>,
      "artist/[mbid]": () => <Text>The artist page</Text>,
      // The layout's other screens, so it finds every route it names.
      artists: OtherRoute,
      albums: OtherRoute,
      songs: OtherRoute,
      genres: OtherRoute,
      "genre/[genre]": OtherRoute,
      blocklist: OtherRoute,
      offline: OtherRoute,
      playlists: OtherRoute,
      "playlist-edit": OtherRoute,
      "artist/favorites": ArtistFavoritesScreen,
      "artist/albums": OtherRoute,
      "artist/releases": OtherRoute,
      "release/[mbid]": OtherRoute,
    },
    {
      initialUrl,
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  answerFavorites();
  mockPost.mockResolvedValue({ data: { changedIds: [] } });
});

describe("favorites screen", () => {
  describe("search", () => {
    const searchBar = () =>
      screen.container.queryAll((node) => node.type === "RNSSearchBar")[0];
    const search = async (text: string) => {
      await act(async () => {
        searchBar().props.onChangeText({ nativeEvent: { text } });
      });
    };
    const ALL_ROWS = [
      "Artists",
      "Sigur Ros",
      "Albums",
      "Second Album",
      "Tracks",
      "First Song",
    ];
    const visibleRows = () =>
      ALL_ROWS.filter((title) => screen.queryByText(title));

    it.each([
      ["an artist's name", "sigur", ["Artists", "Sigur Ros"]],
      ["an album's title", "SECOND", ["Albums", "Second Album"]],
      ["a track's title", "first song", ["Tracks", "First Song"]],
      ["the album a track is on", "first album", ["Tracks", "First Song"]],
      [
        "the artist on albums and tracks",
        "test artist",
        ["Albums", "Second Album", "Tracks", "First Song"],
      ],
    ])("finds favorites by %s", async (_field, text, rows) => {
      await openFavorites();
      await screen.findByText("Sigur Ros");

      await search(text);

      expect(visibleRows()).toEqual(rows);
    });

    it("says so when nothing matches", async () => {
      await openFavorites();
      await screen.findByText("Sigur Ros");

      await search("  polka ");

      expect(visibleRows()).toEqual([]);
      expect(screen.getByText("No results matching “polka”")).toBeTruthy();
    });

    it("keeps the search handler and Sort menu stable, so typing can't rebuild the header", async () => {
      await openFavorites();
      await screen.findByText("Sigur Ros");
      const nativeHeaderProps = () => ({
        menu: IS_IOS
          ? nativeElements("RNSScreenStackHeaderConfig")[0].props
              .headerRightBarButtonItems
          : androidMenuNodes()[0].props.onItemPressed,
        onChangeText: searchBar().props.onChangeText,
      });
      const before = nativeHeaderProps();
      expect(before.menu).toBeDefined();

      await search("sigur");

      expect(nativeHeaderProps().menu).toBe(before.menu);
      expect(nativeHeaderProps().onChangeText).toBe(before.onChangeText);
    });

    it("brings every row back when the search is cleared", async () => {
      await openFavorites();
      await screen.findByText("Sigur Ros");

      await search("polka");
      await search("");

      expect(visibleRows()).toEqual(ALL_ROWS);
    });
  });

  it("opens from the library home", async () => {
    await openFavorites("/");

    await fireEvent.press(await screen.findByText("Favorites"));

    expect(await screen.findByText("Second Album")).toBeTruthy();
  });

  it("narrows to one artist's albums and tracks from its artist page", async () => {
    await openFavorites("/artist/favorites?artistId=3");
    await screen.findByText("First Song");

    expect(
      favoriteReads().map(({ kind, artistId }) => ({ kind, artistId })),
    ).toEqual([
      { kind: "albums", artistId: "3" },
      { kind: "tracks", artistId: "3" },
    ]);
    expect(screen.queryByText("Artists")).toBeNull();
    expect(screen.getByText("Second Album")).toBeTruthy();
    // Saving keeps every favorite, not one artist's.
    expect(allHeaderMenuTitles()).not.toContain("Save Songs");
  });

  it("offers saving every favorite to the phone", async () => {
    await openFavorites();
    await screen.findByText("First Song");

    expect(allHeaderMenuTitles()).toContain("Save Songs");
  });

  it("lists artists, then albums, then tracks, each under its header", async () => {
    await openFavorites();
    await screen.findByText("Artists");

    const rowTitles = [
      "Artists",
      "Sigur Ros",
      "Albums",
      "Second Album",
      "Tracks",
      "First Song",
    ];
    const renderedTitles = screen
      .getAllByText(new RegExp(`^(${rowTitles.join("|")})$`))
      .map((node) => node.props.children);
    expect(renderedTitles).toEqual(rowTitles);
  });

  describe("sort", () => {
    const trackTitles = () =>
      screen
        .getAllByText(/ Song$/)
        .map((node) => node.props.children as string);

    it("asks for every section newest favorite first, as the web does", async () => {
      await openFavorites();
      await screen.findByText("First Song");

      const reads = favoriteReads();
      expect(reads.map((params) => params.kind)).toEqual([
        "artists",
        "albums",
        "tracks",
      ]);
      for (const params of reads) {
        expect(params).toMatchObject({
          favorite: "true",
          sort: "favorited",
          direction: "asc",
          source: "all",
          page: "1",
          pageSize: "100",
        });
      }
      // Songs with no file can't play, so only they ask for playable rows.
      expect(reads.map((params) => params.availableOnly)).toEqual([
        undefined,
        undefined,
        "true",
      ]);
      expect(
        headerMenuItems()
          .filter((item) => item.isOn)
          .map((item) => item.title),
      ).toEqual(["Recently Favorited"]);
    });

    it("lists and plays the tracks in the server's order, not by artist", async () => {
      setBaseUrl("https://music.example");
      setAuthToken("token");
      answerFavorites({
        tracks: [
          libraryPage("tracks", {
            tracks: [
              song(31, "Newest Song", "Zed"),
              song(32, "Older Song", "Abba"),
            ],
            albums: [FIRST_ALBUM],
            artists: [TEST_ARTIST],
          }),
        ],
      });
      await openFavorites();
      await screen.findByText("Newest Song");

      expect(trackTitles()).toEqual(["Newest Song", "Older Song"]);

      await fireEvent.press(screen.getByLabelText("Play Favorites"));
      const [queue] = (playQueueFrom as jest.Mock).mock.calls[0];
      expect(queue.map((item: { title: string }) => item.title)).toEqual([
        "Newest Song",
        "Older Song",
      ]);
    });

    it("rereads every section in the sort picked, and marks it chosen", async () => {
      await openFavorites();
      await screen.findByText("First Song");
      mockGet.mockClear();
      answerFavorites({
        tracks: [
          libraryPage("tracks", {
            tracks: [song(32, "Older Song"), song(31, "Newest Song")],
            albums: [FIRST_ALBUM],
            artists: [TEST_ARTIST],
          }),
        ],
      });

      await chooseSort("Name Z-A");

      await screen.findByText("Older Song");
      expect(trackTitles()).toEqual(["Older Song", "Newest Song"]);
      expect(
        favoriteReads().map(({ kind, sort, direction }) => [
          kind,
          sort,
          direction,
        ]),
      ).toEqual([
        ["artists", "name", "desc"],
        ["albums", "name", "desc"],
        ["tracks", "name", "desc"],
      ]);
      expect(
        headerMenuItems()
          .filter((item) => item.isOn)
          .map((item) => item.title),
      ).toEqual(["Name Z-A"]);
    });

    it.each(["Recently Played", "Most Played"])(
      "says so when %s leaves no favorites, since it skips the unplayed",
      async (sortLabel) => {
        await openFavorites();
        await screen.findByText("First Song");
        answerFavorites({
          artists: [libraryPage("artists")],
          albums: [libraryPage("albums")],
          tracks: [libraryPage("tracks")],
        });

        await chooseSort(sortLabel);

        expect(
          await screen.findByText(
            "You haven't played any of your favorites yet",
          ),
        ).toBeTruthy();
      },
    );

    it("reads every page of a long section, so Play covers every favorite", async () => {
      setBaseUrl("https://music.example");
      setAuthToken("token");
      const firstPageSongs = Array.from({ length: 100 }, (_, index) =>
        song(100 + index, `Page One ${index} Song`),
      );
      const related = { albums: [FIRST_ALBUM], artists: [TEST_ARTIST] };
      answerFavorites({
        tracks: [
          libraryPage(
            "tracks",
            { tracks: firstPageSongs, ...related },
            { total: 101 },
          ),
          libraryPage(
            "tracks",
            { tracks: [song(500, "Last Song")], ...related },
            { page: 2, total: 101 },
          ),
        ],
      });
      await openFavorites();
      await screen.findByText("Page One 0 Song");

      expect(
        favoriteReads()
          .filter((params) => params.kind === "tracks")
          .map((params) => params.page),
      ).toEqual(["1", "2"]);
      await fireEvent.press(screen.getByLabelText("Play Favorites"));
      const [queue] = (playQueueFrom as jest.Mock).mock.calls[0];
      expect(queue).toHaveLength(101);
      expect(queue.at(-1).title).toBe("Last Song");
    });
  });

  it("drops the header of a section with nothing in it", async () => {
    answerFavorites({
      artists: [libraryPage("artists")],
      tracks: [libraryPage("tracks")],
    });
    await openFavorites();

    expect(await screen.findByText("Albums")).toBeTruthy();
    expect(screen.queryByText("Artists")).toBeNull();
    expect(screen.queryByText("Tracks")).toBeNull();
  });

  it("shows an empty state when nothing is starred", async () => {
    answerFavorites({
      artists: [libraryPage("artists")],
      albums: [libraryPage("albums")],
      tracks: [libraryPage("tracks")],
    });
    await openFavorites();

    expect(await screen.findByText(/to find them here/)).toBeTruthy();
  });

  it.each([
    ["Sigur Ros", "The artist page"],
    ["Second Album", "The album page"],
  ])("opens %s's page from its row", async (title, page) => {
    await openFavorites();

    await fireEvent.press(await screen.findByText(title));

    expect(await screen.findByText(page)).toBeTruthy();
  });

  it("plays a tapped track alone, with its album's title and cover", async () => {
    await openFavorites();

    await fireEvent.press(await screen.findByText("First Song"));

    const [queue, track, context] = mockPlayAlbumFromTrack.mock.calls[0];
    expect(queue.map((t: { title: string }) => t.title)).toEqual([
      "First Song",
    ]);
    expect(track.streamPath).toBe("/library/stream/4/30");
    expect(context).toMatchObject({
      albumTitle: "First Album",
      artistName: "Test Artist",
      coverPath: "/api/library/albums/4/cover",
      artistMbid: "test-artist",
    });
  });

  it("plays the favorite songs a search leaves from Play", async () => {
    setBaseUrl("https://music.example");
    setAuthToken("token");
    await openFavorites();
    await screen.findByText("First Song");

    await fireEvent.press(screen.getByLabelText("Play Favorites"));

    const [queue, startId, context] = (playQueueFrom as jest.Mock).mock
      .calls[0];
    expect(queue.map((item: { title: string }) => item.title)).toEqual([
      "First Song",
    ]);
    expect(startId).toBe(queue[0].id);
    expect(context).toMatchObject({ albumTitle: "Favorites" });
  });

  it("keeps a track's favorite action in its three dots, not on the row", async () => {
    await openFavorites();
    await screen.findByText("First Song");

    expect(
      screen.queryByLabelText("Remove First Song from favorites"),
    ).toBeNull();

    await fireEvent.press(screen.getByLabelText("More actions for First Song"));
    await act(async () => {
      fireEvent.press(screen.getByText("Remove from Favorites"));
    });

    expect(mockPost).toHaveBeenCalledWith("/library/favorites", {
      ids: ["song:recording:first-song"],
      starred: false,
    });
  });

  it("removes an album from the list before the server answers", async () => {
    let finishPost = (_value: unknown) => {};
    mockPost.mockReturnValue(
      new Promise((resolve) => {
        finishPost = resolve;
      }),
    );
    await openFavorites();

    await fireEvent.press(
      await screen.findByLabelText("Remove Second Album from favorites"),
    );

    await waitFor(() => {
      expect(screen.queryByText("Second Album")).toBeNull();
    });
    expect(mockPost).toHaveBeenCalledWith("/library/favorites", {
      ids: ["album:release-group:second-album"],
      starred: false,
    });

    await act(async () => {
      finishPost({ data: { changedIds: [] } });
    });
    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Removed from Favorites" }),
    );
  });

  it("rereads once, after the last of two quick removals", async () => {
    const finishPosts: ((value: unknown) => void)[] = [];
    mockPost.mockImplementation(
      () => new Promise((resolve) => finishPosts.push(resolve)),
    );
    await openFavorites();
    const albumHeart = await screen.findByLabelText(
      "Remove Second Album from favorites",
    );
    const artistHeart = screen.getByLabelText(
      "Remove Sigur Ros from favorites",
    );
    await fireEvent.press(albumHeart);
    await fireEvent.press(artistHeart);
    await waitFor(() => expect(finishPosts).toHaveLength(2));
    mockGet.mockClear();

    await act(async () => {
      finishPosts[0]({ data: { changedIds: [] } });
    });
    expect(mockGet).not.toHaveBeenCalled();

    await act(async () => {
      finishPosts[1]({ data: { changedIds: [] } });
    });
    expect(favoriteReads().map((params) => params.kind)).toEqual([
      "artists",
      "albums",
      "tracks",
    ]);
  });

  it("hands the player the artwork a row's cover lookup already found", async () => {
    const client = makeClient();
    client.setQueryData(libraryKeys.albumCover("first-album"), {
      images: [{ image: "https://covers.example/first.jpg", front: true }],
    });
    await openFavorites("/favorites", client);

    await fireEvent.press(await screen.findByText("First Song"));

    expect(mockPlayAlbumFromTrack.mock.calls[0][2].artworkUrl).toBe(
      "https://covers.example/first.jpg",
    );
  });

  it("rereads the Library lists showing only favorites, and leaves the rest", async () => {
    const client = makeClient();
    const view: LibraryAlbumsParams = {
      genre: "",
      query: "",
      sort: "name",
      direction: "asc",
      status: null,
      favorite: false,
    };
    const favoritesView = libraryKeys.albumsAll({ ...view, favorite: true });
    // Rereading every list would reshuffle one sorted at random.
    const wholeView = libraryKeys.albumsAll(view);
    client.setQueryData(favoritesView, { pages: [], pageParams: [] });
    client.setQueryData(wholeView, { pages: [], pageParams: [] });
    await openFavorites("/favorites", client);

    await fireEvent.press(
      await screen.findByLabelText("Remove Second Album from favorites"),
    );

    await waitFor(() =>
      expect(client.getQueryState(favoritesView)?.isInvalidated).toBe(true),
    );
    expect(client.getQueryState(wholeView)?.isInvalidated).toBe(false);
  });

  it("puts a row back and says so when the server refuses the removal", async () => {
    mockPost.mockRejectedValue({ message: "User account required" });
    await openFavorites();
    const heart = await screen.findByLabelText(
      "Remove Sigur Ros from favorites",
    );
    // The reread after the failure never answers, so only the rollback can
    // bring the row back.
    mockGet.mockReturnValue(new Promise(() => {}));

    await fireEvent.press(heart);

    await waitFor(() => {
      expect(Burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Couldn't update favorites",
          message: "User account required",
          preset: "error",
        }),
      );
    });
    expect(screen.getByText("Sigur Ros")).toBeTruthy();
  });

  it("rereads a cached list on open, because other clients change favorites", async () => {
    const client = new QueryClient({
      defaultOptions: {
        // The app's default, which would otherwise hide a web change for
        // five minutes.
        queries: { retry: false, gcTime: Infinity, staleTime: 5 * 60 * 1000 },
      },
    });
    client.setQueryData(
      libraryKeys.favoriteLists({ sort: "favorited", direction: "asc" }),
      { artists: [], albums: [], tracks: [] },
      { updatedAt: Date.now() - 60 * 1000 },
    );
    await openFavorites("/favorites", client);

    expect(await screen.findByText("Sigur Ros")).toBeTruthy();
  });
});

describe("favorites with no connection", () => {
  const album = {
    id: "8",
    artistId: "3",
    artistName: "Test Artist",
    mbid: "second-album",
    albumName: "Second Album",
    title: "Second Album",
    releaseDate: null,
    monitored: false,
    statistics: { trackCount: 1, sizeOnDisk: 1_000, percentOfTracks: 100 },
  } as Album;

  /** A Favorites row, with the queue's copy the store saves from it. */
  function favorite(id: string, trackName: string) {
    const row = {
      id,
      mbid: `mb-${id}`,
      trackName,
      title: trackName,
      trackNumber: 1,
      hasFile: true,
      size: 1_000,
      quality: "FLAC",
      streamPath: `/library/stream/4/${id}`,
      streamFormat: "flac",
      artistName: "Test Artist",
    } as AlbumTrack;
    const track = {
      id,
      title: trackName,
      artist: "Test Artist",
      album: "First Album",
      artwork: null,
      streamPath: row.streamPath!,
    };
    return { track, row };
  }

  beforeEach(async () => {
    await act(async () => {
      await setSavedLibraryUser(1);
      await setFavoritesSave("songs-and-albums");
      // Newest favorite first, as Favorites reads them to save them.
      await applyFavorites({
        songs: [favorite("31", "Zebra Song"), favorite("30", "First Song")],
        albums: [
          {
            ref: "8",
            route: {
              title: "Second Album",
              artistName: "Test Artist",
              artistMbid: "test-artist",
              albumMbid: "second-album",
              coverUrl: "",
              libraryAlbumId: "8",
              artistId: "3",
            },
            album,
            tracks: [favorite("80", "Album Song").row],
          },
        ],
      });
    });
    mockOffline = true;
  });

  afterEach(async () => {
    mockOffline = false;
    await act(async () => {
      await forgetSavedLibrary();
      await setSavedLibraryUser(null);
    });
    resetFileSystem();
  });

  it("lists the favorites the phone keeps, newest favorite first, without asking the server", async () => {
    await openFavorites();

    expect(await screen.findByText("Second Album")).toBeTruthy();
    const songs = screen
      .getAllByText(/^(Zebra|First) Song$/)
      .map((node) => node.props.children);
    expect(songs).toEqual(["Zebra Song", "First Song"]);
    expect(favoriteReads()).toEqual([]);
    // Hearts need the server.
    expect(
      screen.queryByLabelText("Remove Second Album from favorites"),
    ).toBeNull();
  });

  it("sorts on the phone, offering only the sorts it can do", async () => {
    await openFavorites();
    await screen.findByText("Second Album");

    const titles = headerMenuItems().map((item) => item.title);
    expect(titles).toEqual(expect.arrayContaining(["Name A-Z", "Artist A-Z"]));
    expect(titles).not.toContain("Most Played");

    await chooseSort("Name Z-A");
    const songs = screen
      .getAllByText(/^(Zebra|First) Song$/)
      .map((node) => node.props.children);
    expect(songs).toEqual(["Zebra Song", "First Song"]);
    await chooseSort("Name A-Z");
    expect(
      screen
        .getAllByText(/^(Zebra|First) Song$/)
        .map((node) => node.props.children),
    ).toEqual(["First Song", "Zebra Song"]);
  });
});
