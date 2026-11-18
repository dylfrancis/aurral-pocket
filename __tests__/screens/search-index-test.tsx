jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/hooks/search/use-artist-search", () => ({
  useArtistSearch: jest.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
}));

jest.mock("@/hooks/search/use-album-search", () => ({
  useAlbumSearch: jest.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
}));

jest.mock("@/hooks/search/use-library-search", () => ({
  useLibrarySearch: jest.fn(() => ({ data: undefined, isLoading: false })),
}));

jest.mock("@/lib/player/player", () => ({
  playQueueFrom: jest.fn(() => Promise.resolve(true)),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ serverUrl: "http://server", token: "token" }),
}));

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: object) => <View {...props} /> };
});

// The sheet modules load for their hooks; their native parts never render.
jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  return {
    BottomSheetModal: View,
    BottomSheetView: View,
    BottomSheetScrollView: View,
    BottomSheetTextInput: View,
    BottomSheetBackdrop: View,
  };
});

// The sheet owns its contents; this stand-in shows which song it opened for.
jest.mock("@/components/library/TrackActionsSheet", () => {
  const { Text } = require("react-native");
  return {
    ...jest.requireActual("@/components/library/TrackActionsSheet"),
    TrackActionsSheet: ({
      target,
    }: {
      target: { item: { id: string } | null; title?: string } | null;
    }) =>
      target ? (
        <Text>
          Actions for {target.title} ({target.item?.id})
        </Text>
      ) : null,
  };
});

jest.mock("@/hooks/search/use-tag-suggestions", () => ({
  useTagSuggestions: jest.fn(() => ({ data: undefined })),
}));

jest.mock("@expo/material-symbols/mic.xml", () => "Mic");

jest.mock("@/components/shazam", () => ({
  ShazamSheet: () => null,
}));

jest.mock("@/hooks/search/use-library-album-lookup", () => ({
  useLibraryAlbumLookup: jest.fn(() => ({
    statusFor: jest.fn(() => "missing"),
    openAlbum: jest.fn(),
  })),
}));

jest.mock("@/hooks/search/use-library-lookup", () => ({
  useLibraryLookup: jest.fn(() => ({
    isInLibrary: jest.fn(() => false),
    libraryArtists: [],
  })),
}));

const mockPush = jest.fn();
let mockSearchBar: {
  onChangeText: (e: { nativeEvent: { text: string } }) => void;
};
jest.mock("expo-router", () => ({
  useNavigation: jest.fn(() => ({ setOptions: jest.fn() })),
  useRouter: jest.fn(() => ({ push: mockPush })),
  Stack: {
    SearchBar: (props: typeof mockSearchBar) => {
      mockSearchBar = props;
      return null;
    },
    Screen: () => null,
    Toolbar: Object.assign(() => null, { Button: () => null }),
  },
}));

jest.mock("@shopify/flash-list", () => {
  const { FlatList } = require("react-native");
  return { FlashList: FlatList };
});

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockAnimatedView = React.forwardRef(function MockAnimatedView(
    props: any,
    ref: any,
  ) {
    return React.createElement(View, { ...props, ref });
  });
  return {
    __esModule: true,
    default: { View: MockAnimatedView },
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (val: number) => ({ value: val }),
    withRepeat: (val: any) => val,
    withTiming: (val: any) => val,
    interpolate: () => 0,
  };
});

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SearchScreen from "@/app/(app)/(tabs)/(search)/index";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import { playQueueFrom } from "@/lib/player/player";
import type {
  LibrarySearchPlaylist,
  LibrarySearchTrack,
} from "@/lib/types/search";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import { useLibrarySearch } from "@/hooks/search/use-library-search";
import { useTagSuggestions } from "@/hooks/search/use-tag-suggestions";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";

const mockUseArtistSearch = useArtistSearch as jest.Mock;
const mockUseTagSuggestions = useTagSuggestions as jest.Mock;
const mockUseLibraryLookup = useLibraryLookup as jest.Mock;
const mockUseLibrarySearch = useLibrarySearch as jest.Mock;
const mockPlayQueueFrom = playQueueFrom as jest.Mock;

function song(id: string, title: string): LibrarySearchTrack {
  return {
    id,
    title,
    artistName: "Radiohead",
    albumTitle: "OK Computer",
    albumMbid: "rg-ok-computer",
    libraryAlbumId: "12",
    trackMbid: null,
    artistMbid: "radiohead",
    releaseYear: "1997",
    durationMs: 261000,
    streamPath: `/library/stream/12/${id}`,
    coverUrl: "/api/library/albums/12/cover",
  };
}

function playlist(
  overrides: Partial<LibrarySearchPlaylist>,
): LibrarySearchPlaylist {
  return {
    id: "p1",
    name: "Karma Mix",
    trackCount: null,
    sourceFlowId: null,
    trackMatch: null,
    ...overrides,
  };
}

function libraryResults(
  tracks: LibrarySearchTrack[],
  playlists: LibrarySearchPlaylist[] = [],
) {
  mockUseLibrarySearch.mockReturnValue({
    data: { tracks, playlists },
    isLoading: false,
    isPlaceholderData: false,
  });
}

let client: QueryClient;

async function renderSearch() {
  await render(
    <QueryClientProvider client={client}>
      <SearchScreen />
    </QueryClientProvider>,
  );
}

async function typeQuery(text: string) {
  await act(async () => mockSearchBar.onChangeText({ nativeEvent: { text } }));
}

beforeAll(() => {
  setBaseUrl("http://server");
  setAuthToken("token");
});

afterEach(() => client.clear());

afterAll(() => setAuthToken(null));

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient();
  mockUseLibrarySearch.mockReturnValue({ data: undefined, isLoading: false });
  mockUseArtistSearch.mockReturnValue({
    data: undefined,
    isLoading: false,
  });
  mockUseTagSuggestions.mockReturnValue({ data: undefined });
  mockUseLibraryLookup.mockReturnValue({
    isInLibrary: jest.fn(() => false),
    libraryArtists: [],
  });
});

describe("SearchScreen", () => {
  it("shows empty state by default", async () => {
    await renderSearch();
    expect(
      screen.getByText("Search for artists, songs, playlists or #tags"),
    ).toBeTruthy();
  });

  it("plays a Library song on its own, and opens its actions from ⋯", async () => {
    libraryResults([song("77", "Karma Police"), song("78", "Lucky")]);
    await renderSearch();
    await typeQuery("karma");

    await fireEvent.press(screen.getByText("Karma Police"));

    expect(mockPlayQueueFrom).toHaveBeenCalledTimes(1);
    const [items, startId, album] = mockPlayQueueFrom.mock.calls[0];
    expect(items).toEqual([
      expect.objectContaining({
        id: "77",
        streamPath: "/library/stream/12/77",
        albumRef: "12",
      }),
    ]);
    expect(startId).toBe("77");
    expect(album).toEqual(
      expect.objectContaining({ albumTitle: "OK Computer", albumRef: "12" }),
    );

    await fireEvent.press(
      screen.getByLabelText("More actions for Karma Police"),
    );
    expect(screen.getByText("Actions for Karma Police (77)")).toBeTruthy();
  });

  it("shows three songs and sends See all to the Songs results", async () => {
    libraryResults([
      song("1", "Karma Police"),
      song("2", "Karma Chameleon"),
      song("3", "Karma"),
      song("4", "Karmageddon"),
    ]);
    await renderSearch();
    await typeQuery("karma");

    expect(screen.queryByText("Karmageddon")).toBeNull();
    await fireEvent.press(screen.getByText("See all songs"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/results",
      params: { q: "karma", scope: "song" },
    });
  });

  it("opens a matching flow and playlist on their own pages", async () => {
    libraryResults(
      [],
      [
        playlist({ id: "f1", name: "Karma Mix", sourceFlowId: "f1" }),
        playlist({
          id: "p2",
          name: "Road Trip",
          trackCount: 24,
          trackMatch: { title: "Karma Police", count: 3 },
        }),
      ],
    );
    await renderSearch();
    await typeQuery("karma");

    expect(screen.getByText("Playlist · 24 tracks")).toBeTruthy();
    expect(screen.getByText("Has Karma Police and 2 more")).toBeTruthy();

    await fireEvent.press(screen.getByText("Karma Mix"));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: "/flow/[id]",
      params: { id: "f1" },
    });

    await fireEvent.press(screen.getByText("Road Trip"));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: "/playlist/[id]",
      params: { id: "p2" },
    });
  });
});
