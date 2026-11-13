jest.mock("@/lib/api/client", () => ({
  ...jest.requireActual("@/lib/api/client"),
  api: { get: jest.fn(), post: jest.fn() },
}));

jest.mock("@/lib/player/player", () => ({
  playAlbumFromTrack: jest.fn(() => Promise.resolve(true)),
  playNextInQueue: jest.fn(),
  addToQueue: jest.fn(),
  setShuffle: jest.fn(),
}));

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

jest.mock("@/components/flow/AddToPlaylistSheet", () => ({
  AddToPlaylistSheet: () => null,
  useAddToPlaylist: () => ({
    canAddToPlaylist: false,
    track: null,
    open: jest.fn(),
    close: jest.fn(),
  }),
}));

jest.mock("@/components/ui/AppSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AppSheet: React.forwardRef(function MockAppSheet(
      { children }: any,
      _ref: any,
    ) {
      return React.createElement(View, null, children);
    }),
  };
});

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    BottomSheetView: ({ children }: any) =>
      React.createElement(View, null, children),
  };
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
import * as Burnt from "burnt";
import LibraryLayout from "@/app/(app)/(tabs)/(library)/_layout";
import LibraryFavoritesScreen, {
  ErrorBoundary,
} from "@/app/(app)/(tabs)/(library)/favorites";
import LibraryHome from "@/app/(app)/(tabs)/(library)/index";
import { api } from "@/lib/api/client";
import { playAlbumFromTrack } from "@/lib/player/player";
import { libraryKeys } from "@/lib/query-keys";

const mockGet = api.get as jest.Mock;
const mockPost = api.post as jest.Mock;
const mockPlayAlbumFromTrack = playAlbumFromTrack as jest.Mock;

// The shape a 2.13.0 server sends: starred ids, plus the rows they name, their
// parents and their children.
const favoritesResponse = {
  artist: [{ id: "artist:mbid:sigur-ros" }],
  album: [{ id: "album:release-group:second-album" }],
  song: [{ id: "song:recording:first-song" }],
  library: {
    artists: [
      {
        id: 1,
        name: "Sigur Ros",
        identityKey: "mbid:sigur-ros",
        mbid: "sigur-ros",
      },
      {
        id: 3,
        name: "Test Artist",
        identityKey: "mbid:test-artist",
        mbid: "test-artist",
      },
    ],
    albums: [
      {
        id: 4,
        artistId: 3,
        title: "First Album",
        identityKey: "release-group:first-album",
        coverUrl: "/api/library/albums/4/cover",
        mbid: "first-album",
      },
      {
        id: 8,
        artistId: 3,
        title: "Second Album",
        identityKey: "release-group:second-album",
      },
    ],
    tracks: [
      {
        id: 30,
        title: "First Song",
        artistName: "Test Artist",
        identityKey: "recording:first-song",
        albums: [{ albumId: 4, trackNumber: 1 }],
        files: [{ id: 1, albumId: 4, available: true }],
      },
      {
        id: 60,
        title: "Child Of A Starred Album",
        identityKey: "recording:second-song",
        albums: [{ albumId: 8, trackNumber: 1 }],
      },
    ],
  },
};

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
      genres: OtherRoute,
      "genre/[genre]": OtherRoute,
      blocklist: OtherRoute,
      offline: OtherRoute,
      playlists: OtherRoute,
      "playlist-edit": OtherRoute,
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
  mockGet.mockResolvedValue({ data: favoritesResponse });
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

    it("keeps the search handler stable, so typing can't rebuild the header", async () => {
      await openFavorites();
      await screen.findByText("Sigur Ros");
      const before = searchBar().props.onChangeText;

      await search("sigur");

      expect(searchBar().props.onChangeText).toBe(before);
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

  it("drops the header of a section with nothing in it", async () => {
    mockGet.mockResolvedValue({
      data: { ...favoritesResponse, artist: [], song: [] },
    });
    await openFavorites();

    expect(await screen.findByText("Albums")).toBeTruthy();
    expect(screen.queryByText("Artists")).toBeNull();
    expect(screen.queryByText("Tracks")).toBeNull();
  });

  it("shows an empty state when nothing is starred", async () => {
    mockGet.mockResolvedValue({
      data: {
        artist: [],
        album: [],
        song: [],
        library: favoritesResponse.library,
      },
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
    expect(track.streamPath).toBe("/library/canonical-stream/4/30");
    expect(context).toMatchObject({
      albumTitle: "First Album",
      artistName: "Test Artist",
      coverPath: "/api/library/albums/4/cover",
      artistMbid: "test-artist",
    });
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
    expect(mockGet).toHaveBeenCalledTimes(1);
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
      libraryKeys.favorites(),
      { artists: [], albums: [], tracks: [] },
      { updatedAt: Date.now() - 60 * 1000 },
    );
    await openFavorites("/favorites", client);

    expect(await screen.findByText("Sigur Ros")).toBeTruthy();
  });
});
