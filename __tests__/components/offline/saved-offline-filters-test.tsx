const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  // The native menu renders nothing under Jest, so each action renders as a
  // pressable named by its title, carrying whether it's on or can be picked.
  const MenuAction = ({ children, isOn, disabled, onPress }: any) =>
    React.createElement(
      Pressable,
      {
        accessibilityRole: "menuitem",
        accessibilityLabel: children,
        accessibilityState: { checked: !!isOn, disabled: !!disabled },
        onPress: disabled ? undefined : onPress,
      },
      React.createElement(Text, null, children),
    );
  const Passthrough = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  return {
    useRouter: () => ({ push: mockPush }),
    useLocalSearchParams: () => ({}),
    Stack: {
      Screen: () => null,
      SearchBar: () => null,
      Toolbar: Object.assign(Passthrough, { Menu: Passthrough, MenuAction }),
    },
  };
});

jest.mock("@shopify/flash-list", () => {
  const { FlatList } = require("react-native");
  return { FlashList: FlatList };
});

jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));
jest.mock("@/components/flow/CollectionArtwork", () => ({
  CollectionArtwork: () => null,
}));

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => () => true,
}));

let mockOffline = false;
jest.mock("@/lib/offline/network", () => ({
  isOffline: () => mockOffline,
  useIsOffline: () => mockOffline,
  onNetworkChange: () => () => {},
  networkKnown: () => Promise.resolve(),
}));

// What the server lists. Each screen's own hook is stood in for, so these
// tests are about the filter, not the server's paging or sorting.
let mockLibraryAlbums: unknown[] = [];
let mockTypedQuery = "";
jest.mock("@/hooks/library/use-album-grid", () => ({
  useAlbumGrid: () => ({
    items: mockLibraryAlbums,
    isLoading: false,
    refreshing: false,
    handleRefresh: jest.fn(),
    loadMore: jest.fn(),
    isFetchingNextPage: false,
    sortMode: "name-asc",
    setSortMode: jest.fn(),
    sortOptions: [],
    setSearchQuery: jest.fn(),
    typedQuery: mockTypedQuery,
    settledQuery: mockTypedQuery,
    hasUnderlyingItems: mockLibraryAlbums.length > 0,
  }),
}));

let mockArtistAlbums: unknown[] = [];
jest.mock("@/hooks/library/use-release-grid", () => ({
  useReleaseGrid: () => ({
    items: mockArtistAlbums,
    isLoading: false,
    refreshing: false,
    handleRefresh: jest.fn(),
    sortMode: "date-desc",
    setSortMode: jest.fn(),
    sortOptions: [],
    searchQuery: "",
    setSearchQuery: jest.fn(),
    hasUnderlyingItems: mockArtistAlbums.length > 0,
    artistName: "Radiohead",
    artistMbid: "artist-mb",
    rawAlbums: mockArtistAlbums,
  }),
}));
jest.mock("@/hooks/library/use-download-statuses", () => ({
  useDownloadStatuses: () => ({ data: undefined }),
}));

let mockPlaylists: unknown[] = [];
jest.mock("@/hooks/flow", () => ({
  useFlowStatusSuspense: () => ({
    data: {
      sharedPlaylists: mockPlaylists,
      sharedPlaylistStats: {},
      retryCyclePausedByPlaylist: {},
    },
    refetch: jest.fn(),
  }),
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AlbumsGridScreen } from "@/components/artist/AlbumsGridScreen";
import { LibraryAlbumsScreen } from "@/components/library/LibraryAlbumsScreen";
import LibraryPlaylistsScreen from "@/app/(app)/(tabs)/(library)/playlists";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import {
  forgetSavedLibrary,
  saveAlbum,
  savePlaylist,
  setSavedLibraryUser,
} from "@/lib/offline/saved-library";
import { downloads } from "@/test-support/expo-file-system";
import type { FlowJob, SharedPlaylist } from "@/lib/types/flow";
import type { Album, Track } from "@/lib/types/library";

/** Lets the saved library's reads, writes and downloads land. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function album(id: string, albumName: string): Album {
  return {
    id,
    canonicalId: id,
    artistId: "7",
    artistName: "Radiohead",
    mbid: `rg-${id}`,
    foreignAlbumId: `rg-${id}`,
    albumName,
    title: albumName,
    releaseDate: "2000-10-02",
    monitored: true,
    statistics: { trackCount: 1, sizeOnDisk: 1, percentOfTracks: 100 },
  };
}

function track(id: string): Track {
  return {
    id,
    mbid: `mb-${id}`,
    trackName: `Track ${id}`,
    title: `Track ${id}`,
    trackNumber: 1,
    hasFile: true,
    size: 1_000,
    quality: "FLAC",
    streamPath: `/library/canonical-stream/x/${id}`,
    streamFormat: "flac",
  };
}

function route(title: string) {
  return {
    title,
    artistName: "Radiohead",
    artistMbid: "artist-mb",
    albumMbid: "",
    coverUrl: "",
    lidarrAlbumId: "",
    canonicalAlbumId: "",
    artistId: "",
  };
}

function playlist(id: string, name: string): SharedPlaylist {
  return {
    id,
    name,
    sourceName: null,
    sourceFlowId: null,
    trackCount: 1,
    recordHistory: true,
  };
}

const KID_A = album("12", "Kid A");
const HAIL = album("14", "Hail to the Thief");

async function saveEverything() {
  // One with the library's record, one from what the page was opened with.
  saveAlbum({
    ref: "12",
    route: route("Kid A"),
    tracks: [track("71")],
    album: KID_A,
  });
  saveAlbum({ ref: "13", route: route("OK Computer"), tracks: [track("81")] });
  savePlaylist({
    playlist: playlist("pl-1", "Road Trip"),
    jobs: [{ id: "job-1", status: "done" } as FlowJob],
  });
  await settle();
  while (downloads.length > 0) {
    downloads.shift()!.finish(1_000);
    await settle();
  }
}

async function pick(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });
}

beforeEach(async () => {
  setBaseUrl("https://music.example");
  setAuthToken("session-token");
  setSavedLibraryUser(1);
  await settle();
  await saveEverything();
  mockLibraryAlbums = [HAIL];
  mockArtistAlbums = [KID_A, HAIL];
  mockPlaylists = [playlist("pl-1", "Road Trip"), playlist("pl-2", "Gym")];
  mockTypedQuery = "";
});

afterEach(async () => {
  mockOffline = false;
  mockPush.mockClear();
  await forgetSavedLibrary();
  setSavedLibraryUser(null);
});

describe("Library › Albums", () => {
  it("lists the saved albums from the phone, searched there, and opens the page each was saved from", async () => {
    await render(<LibraryAlbumsScreen />);
    expect(screen.getByText("Hail to the Thief")).toBeTruthy();

    await pick("Saved Offline");

    // The server's page doesn't hold them; the phone does.
    expect(screen.queryByText("Hail to the Thief")).toBeNull();
    expect(screen.getByText("Kid A")).toBeTruthy();
    expect(screen.getByText("OK Computer")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Kid A"));
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/album/[ref]",
      params: { ref: "12", ...route("Kid A") },
    });
  });

  it("searches the saved albums on the phone", async () => {
    mockTypedQuery = "comp";
    await render(<LibraryAlbumsScreen />);

    await pick("Saved Offline");

    expect(screen.getByText("OK Computer")).toBeTruthy();
    expect(screen.queryByText("Kid A")).toBeNull();
  });

  it("with no connection, shows the saved albums by itself and holds All Albums back", async () => {
    mockOffline = true;
    await render(<LibraryAlbumsScreen />);

    expect(screen.getByText("Kid A")).toBeTruthy();
    expect(screen.queryByText("Hail to the Thief")).toBeNull();
    expect(
      screen.getByLabelText("Saved Offline").props.accessibilityState,
    ).toEqual({ checked: true, disabled: false });
    expect(
      screen.getByLabelText("All Albums").props.accessibilityState,
    ).toEqual({ checked: false, disabled: true });
  });

  it("offers no Saved Offline view for a genre, whose saves aren't known", async () => {
    await render(<LibraryAlbumsScreen genre="Electronic" />);

    expect(screen.queryByLabelText("Saved Offline")).toBeNull();
  });
});

describe("Artist › Albums", () => {
  it("narrows the artist's albums to the saved ones", async () => {
    await render(<AlbumsGridScreen />);

    await pick("Saved Offline");

    expect(screen.getByText("Kid A")).toBeTruthy();
    expect(screen.queryByText("Hail to the Thief")).toBeNull();
  });
});

describe("Library › Playlists", () => {
  it("narrows the playlists to the saved ones", async () => {
    await render(<LibraryPlaylistsScreen />);
    expect(screen.getByText("Gym")).toBeTruthy();

    await pick("Saved Offline");

    expect(screen.getByText("Road Trip")).toBeTruthy();
    expect(screen.queryByText("Gym")).toBeNull();
  });
});
