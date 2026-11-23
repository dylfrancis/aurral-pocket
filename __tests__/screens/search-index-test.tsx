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

jest.mock("@/hooks/search/use-catalog-search", () => ({
  useCatalogSearch: jest.fn(),
}));

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => () => true,
}));

// The real pills are SwiftUI and Compose views.
jest.mock("@/components/ui/PillRow", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    PillRow: ({ items, selected, onSelect }: any) => (
      <View>
        {items.map((item: any) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.id === selected }}
            onPress={() => onSelect(item.id)}
          >
            <Text>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

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

let mockShazamSheet: { onSearchManually: (query: string) => void };
jest.mock("@/components/shazam", () => ({
  ShazamSheet: (props: typeof mockShazamSheet) => {
    mockShazamSheet = props;
    return null;
  },
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
type TextEvent = { nativeEvent: { text: string } };
let mockSearchBar: {
  onChangeText: (e: TextEvent) => void;
  onSearchButtonPress: (e: TextEvent) => void;
};
const mockSearchBarCommands = { setText: jest.fn(), blur: jest.fn() };
jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useNavigation: jest.fn(() => ({ setOptions: jest.fn() })),
    useRouter: jest.fn(() => ({ push: mockPush })),
    Stack: {
      SearchBar: React.forwardRef(function MockSearchBar(
        props: typeof mockSearchBar,
        ref: unknown,
      ) {
        mockSearchBar = props;
        React.useImperativeHandle(ref, () => mockSearchBarCommands);
        return null;
      }),
      Screen: () => null,
      Toolbar: Object.assign(() => null, { Button: () => null }),
    },
  };
});

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
  CatalogSearchResponse,
  LibrarySearchResponse,
  LibrarySearchPlaylist,
  LibrarySearchTrack,
} from "@/lib/types/search";
import { useCatalogSearch } from "@/hooks/search/use-catalog-search";
import { useLibrarySearch } from "@/hooks/search/use-library-search";
import { useTagSuggestions } from "@/hooks/search/use-tag-suggestions";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";

const mockUseCatalogSearch = useCatalogSearch as jest.Mock;
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

const mockRefetchCatalog = jest.fn();

function libraryResults(
  tracks: LibrarySearchTrack[],
  playlists: LibrarySearchPlaylist[] = [],
  more: Partial<Pick<LibrarySearchResponse, "artists" | "albums">> = {},
) {
  mockUseLibrarySearch.mockReturnValue({
    data: { artists: [], albums: [], ...more, tracks, playlists },
    isLoading: false,
    isPlaceholderData: false,
  });
}

function catalogResults(data: Partial<CatalogSearchResponse>) {
  mockUseCatalogSearch.mockReturnValue({
    data: { status: "ok", artists: [], albums: [], ...data },
    isLoading: false,
    isPlaceholderData: false,
    isError: false,
    refetch: mockRefetchCatalog,
  });
}

function catalogAlbum(id: string, title: string) {
  return {
    type: "album" as const,
    id,
    title,
    artistName: "Various Artists",
    artistMbid: "a1",
    releaseDate: "1998-04-20",
    primaryType: "Album",
    secondaryTypes: [],
    coverUrl: null,
  };
}

const songs = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    song(String(index + 1), `Karma ${index + 1}`),
  );

const pill = (label: string) => screen.getByRole("tab", { name: label });

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

async function pressSearch(text: string) {
  await act(async () =>
    mockSearchBar.onSearchButtonPress({ nativeEvent: { text } }),
  );
}

beforeAll(() => {
  setBaseUrl("http://server");
  setAuthToken("token");
});

afterEach(() => client.clear());

afterAll(() => setAuthToken(null));

beforeEach(() => {
  jest.clearAllMocks();
  // Artist rows read their artwork through the cache, and a default gcTime
  // timer would hold the Jest process open for five minutes after the run.
  client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  mockUseLibrarySearch.mockReturnValue({ data: undefined, isLoading: false });
  catalogResults({});
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

  it("keeps the results on screen when Search is pressed, with more rows and pills", async () => {
    libraryResults(songs(6));
    await renderSearch();
    await typeQuery("karma");
    expect(screen.queryByText("Karma 4")).toBeNull();

    await pressSearch("karma");

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSearchBarCommands.blur).toHaveBeenCalled();
    expect(pill("All").props.accessibilityState.selected).toBe(true);
    expect(screen.getByText("Karma 5")).toBeTruthy();
    expect(screen.queryByText("Karma 6")).toBeNull();
  });

  it("opens a section's whole list in place from See all", async () => {
    libraryResults(songs(4));
    await renderSearch();
    await typeQuery("karma");

    await fireEvent.press(screen.getByText("See all songs"));

    expect(mockPush).not.toHaveBeenCalled();
    expect(pill("Songs").props.accessibilityState.selected).toBe(true);
    expect(screen.getByText("Karma 4")).toBeTruthy();
  });

  it("lists a Library match once, ahead of the catalog's", async () => {
    libraryResults([], [], {
      artists: [
        {
          id: "a1",
          libraryId: "5",
          hasMbid: true,
          name: "Massive Attack",
          image: null,
        },
      ],
      albums: [
        {
          id: "rg-mezzanine",
          libraryId: "12",
          title: "Mezzanine",
          artistName: "Various Artists",
          artistMbid: "a1",
          releaseDate: "1998-04-20",
          coverUrl: null,
        },
      ],
    });
    catalogResults({
      artists: [
        { id: "a2", name: "Massive Attack Tribute" },
        { id: "a1", name: "Massive Attack" },
      ],
      albums: [
        catalogAlbum("rg-blue-lines", "Blue Lines"),
        catalogAlbum("rg-mezzanine", "Mezzanine"),
      ],
    });
    await renderSearch();
    await typeQuery("massive");

    expect(
      screen
        .getAllByText(/^Massive Attack( Tribute)?$/)
        .map((node) => node.props.children),
    ).toEqual(["Massive Attack", "Massive Attack Tribute"]);
    expect(
      screen
        .getAllByText(/^(Mezzanine|Blue Lines)$/)
        .map((node) => node.props.children),
    ).toEqual(["Mezzanine", "Blue Lines"]);
  });

  it("shows Library artists and albums when the catalog doesn't answer", async () => {
    libraryResults([], [], {
      artists: [
        {
          id: "a1",
          libraryId: "5",
          hasMbid: true,
          name: "Massive Attack",
          image: null,
        },
      ],
    });
    catalogResults({ status: "unavailable" });
    await renderSearch();
    await typeQuery("massive");

    expect(screen.getByText("Massive Attack")).toBeTruthy();
    expect(
      screen.getByText(
        "The catalog didn\u2019t answer, so only your Library shows.",
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText("Try Again"));
    expect(mockRefetchCatalog).toHaveBeenCalled();
  });

  it("says the catalog didn't answer instead of finding nothing", async () => {
    libraryResults([]);
    catalogResults({ status: "unavailable" });
    await renderSearch();
    await typeQuery("massive");

    expect(screen.queryByText(/^No results for/)).toBeNull();
    expect(
      screen.getByText(
        "The catalog didn\u2019t answer, and nothing in your Library matches \u201Cmassive\u201D",
      ),
    ).toBeTruthy();
  });

  it("fills the bar and lists artists for a search by hand from Shazam", async () => {
    await renderSearch();

    await act(async () => mockShazamSheet.onSearchManually("Massive Attack"));

    expect(mockSearchBarCommands.setText).toHaveBeenCalledWith(
      "Massive Attack",
    );
    expect(pill("Artists").props.accessibilityState.selected).toBe(true);
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
