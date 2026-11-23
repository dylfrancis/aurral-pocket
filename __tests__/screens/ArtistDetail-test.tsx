jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: any) =>
      React.createElement(View, {
        testID: "cover-image",
        accessibilityLabel: props.source?.uri,
      }),
  };
});

jest.mock("@/lib/api/library", () => ({
  deleteLibraryArtist: jest.fn(),
  getArtistQueue: jest.fn(() => Promise.resolve([])),
  getArtistPreviewTracks: jest.fn(() => Promise.resolve([])),
  updateLibraryFavorites: jest.fn(() => Promise.resolve({ changedIds: [] })),
  getCanonicalLibraryPage: jest.fn(),
  favoriteEntityId: jest.requireActual("@/lib/api/library").favoriteEntityId,
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    getAllKeys: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
  },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View, ScrollView } = require("react-native");
  const MockAnimatedView = React.forwardRef(function MockAnimatedView(
    props: any,
    ref: any,
  ) {
    return React.createElement(View, { ...props, ref });
  });
  const MockAnimatedScrollView = React.forwardRef(
    function MockAnimatedScrollView(props: any, ref: any) {
      return React.createElement(ScrollView, { ...props, ref });
    },
  );
  return {
    __esModule: true,
    default: { View: MockAnimatedView, ScrollView: MockAnimatedScrollView },
    useAnimatedReaction: jest.fn(),
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (val: number) => ({ value: val }),
    useAnimatedScrollHandler: () => () => {},
    withRepeat: jest.fn(),
    withTiming: jest.fn(),
    interpolate: () => 0,
  };
});

jest.mock("react-native-worklets", () => ({ scheduleOnRN: jest.fn() }));

jest.mock("expo-router/react-navigation", () => ({
  useHeaderHeight: () => 0,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/hooks/library/use-cover-art-url", () => ({
  ...jest.requireActual("@/hooks/library/use-cover-art-url"),
  useCoverArtUrl: jest.fn(() => ({
    url: "https://example.com/art.jpg",
    isLoading: false,
  })),
}));

const mockPush = jest.fn();
const mockSetParams = jest.fn();
jest.mock("expo-router", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  // The native menu renders nothing under Jest, so each action renders as a
  // pressable labelled by its title, and a hidden action renders nothing.
  const MenuAction = ({ children, hidden, onPress }: any) =>
    hidden
      ? null
      : React.createElement(
          Pressable,
          { onPress },
          React.createElement(Text, null, children),
        );
  const Passthrough = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  const Toolbar = Object.assign(Passthrough, {
    Menu: Passthrough,
    MenuAction,
    Button: () => null,
  });
  return {
    useLocalSearchParams: jest.fn(() => ({
      mbid: "0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    })),
    useRouter: jest.fn(() => ({
      back: jest.fn(),
      push: mockPush,
      setParams: mockSetParams,
    })),
    Stack: { Screen: () => null, Toolbar },
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: function MockLinearGradient(props: any) {
      return React.createElement(View, props);
    },
  };
});

jest.mock("@/components/library/ReleaseGroupCard", () => {
  const React = require("react");
  const { Text, Pressable } = require("react-native");
  return {
    ReleaseGroupCard: function MockReleaseGroupCard({
      releaseGroup,
      onPress,
    }: any) {
      return React.createElement(
        Pressable,
        { onPress },
        React.createElement(Text, {}, releaseGroup.title),
      );
    },
  };
});

jest.mock("@/components/search/AddArtistSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AddArtistSheet: React.forwardRef(function MockAddArtistSheet(
      _: any,
      ref: any,
    ) {
      return React.createElement(View, { testID: "add-artist-sheet" });
    }),
  };
});

jest.mock("@/components/search/SimilarArtistCard", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SimilarArtistCard: function MockSimilarArtistCard() {
      return React.createElement(View, { testID: "similar-artist-card" });
    },
  };
});

// The pills are SwiftUI or Compose. Each stands in as a tab named by its label.
jest.mock("@/components/ui/PillRow", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    PillRow: ({ items, selected, onSelect }: any) =>
      React.createElement(
        View,
        null,
        items.map((item: any) =>
          React.createElement(
            Pressable,
            {
              key: item.id,
              accessibilityRole: "tab",
              accessibilityLabel: item.label,
              accessibilityState: { selected: item.id === selected },
              onPress: () => onSelect(item.id),
            },
            React.createElement(Text, null, item.label),
          ),
        ),
      ),
  };
});

// A view picked in one test would otherwise carry into the next.
jest.mock("@/hooks/library/use-library-view", () =>
  require("@/test-support/library-view"),
);

jest.mock("@/hooks/search/use-similar-artists", () => ({
  useSimilarArtists: jest.fn(() => ({ data: [] })),
}));

jest.mock("@/hooks/search/use-library-lookup", () => ({
  useLibraryLookup: jest.fn(() => ({
    isInLibrary: () => true,
    libraryArtists: [],
  })),
}));

jest.mock("@/hooks/library/use-artist-details", () => ({
  useArtistDetails: jest.fn(() => ({
    data: {
      tags: [],
      bio: "A test biography.",
      "release-groups": [],
    },
    isPending: false,
    isLoading: false,
    error: null,
  })),
}));

jest.mock("@/lib/player/player", () => ({
  ...jest.requireActual("@/lib/player/player"),
  playQueueFrom: jest.fn(() => Promise.resolve(true)),
  setShuffle: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/components/library/ArtistTags", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    ArtistTags: function MockArtistTags() {
      return React.createElement(View, { testID: "artist-tags" });
    },
  };
});

jest.mock("@/hooks/library/use-library-artist", () => ({
  useLibraryArtist: jest.fn(),
  useCanonicalArtist: jest.fn(),
}));

jest.mock("@/hooks/library/use-library-albums", () => ({
  useLibraryAlbums: jest.fn(),
}));

jest.mock("@/hooks/library/use-albums-with-types", () => ({
  useAlbumsWithTypes: jest.fn((_mbid: string, albums: any[]) => ({
    albums: albums?.map((a: any) => ({
      albumType: "Album",
      secondaryTypes: [],
      ...a,
    })),
    otherReleases: [],
    isLoadingTypes: false,
  })),
}));

jest.mock("@/hooks/library/use-download-statuses", () => ({
  useDownloadStatuses: jest.fn(() => ({ data: undefined })),
}));

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: jest.fn(() => () => true),
}));

// The sheet has its own tests; this one hands back what a save returned.
let mockMatchResult: unknown;
jest.mock("@/components/artist/MatchArtistSheet", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    ...jest.requireActual("@/components/artist/MatchArtistSheet"),
    MatchArtistSheet: ({ onSaved }: any) =>
      React.createElement(
        Pressable,
        { onPress: () => onSaved(mockMatchResult) },
        React.createElement(Text, null, "Save Match"),
      ),
  };
});

const mockScan = jest.fn();
jest.mock("@/hooks/library/use-library-scan", () => ({
  useLibraryScan: () => ({ scan: mockScan, isScanning: false }),
}));

jest.mock("@/lib/api/plugins", () => ({
  getPluginActions: jest.fn(),
  runPluginAction: jest.fn(),
}));

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getArtistPreviewTracks,
  getArtistQueue,
  getCanonicalLibraryPage,
  updateLibraryFavorites,
} from "@/lib/api/library";
import ArtistDetailScreen, {
  ErrorBoundary,
} from "@/app/(app)/(tabs)/(library)/artist/[mbid]";
import ActivityArtistScreen from "@/app/(app)/(tabs)/(activity)/artist/[mbid]";
import {
  useCanonicalArtist,
  useLibraryArtist,
} from "@/hooks/library/use-library-artist";
import { useLibraryAlbums } from "@/hooks/library/use-library-albums";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { ApiError, setAuthToken, setBaseUrl } from "@/lib/api/client";
import * as Burnt from "burnt";
import { playQueueFrom, setShuffle } from "@/lib/player/player";
import { getPluginActions, runPluginAction } from "@/lib/api/plugins";
import type {
  Artist,
  Album,
  LibraryQueueTrack,
  PreviewTrack,
} from "@/lib/types/library";

const mockGetArtistQueue = getArtistQueue as jest.Mock;
const mockGetArtistPreviewTracks = getArtistPreviewTracks as jest.Mock;
const mockGetCanonicalLibraryPage = getCanonicalLibraryPage as jest.Mock;
const mockPlayQueueFrom = playQueueFrom as jest.Mock;
const mockSetShuffle = setShuffle as jest.Mock;

async function renderScreen(Screen: React.ComponentType = ArtistDetailScreen) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return await render(
    <QueryClientProvider client={queryClient}>
      <Screen />
    </QueryClientProvider>,
  );
}

const mockUseLibraryArtist = useLibraryArtist as jest.Mock;
const mockUseCanonicalArtist = useCanonicalArtist as jest.Mock;
const mockUseLibraryAlbums = useLibraryAlbums as jest.Mock;
const mockUseLibraryLookup = useLibraryLookup as jest.Mock;
const mockGetPluginActions = getPluginActions as jest.Mock;
const mockRunPluginAction = runPluginAction as jest.Mock;

const NOTE_ARTIST = {
  pluginId: "eden",
  pluginName: "Eden",
  id: "artist",
  label: "Note this artist",
  target: "artist",
};

const baseArtist: Artist = {
  id: "1",
  mbid: "0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  artistName: "Test Artist",
  monitored: true,
  addedAt: "2024-01-01",
  statistics: { albumCount: 2, trackCount: 20, sizeOnDisk: 1000 },
};

const makeAlbum = (overrides: Partial<Album> & { id: string }): Album => ({
  artistId: "1",
  artistName: "Test Artist",
  mbid: `mbid-${overrides.id}`,
  albumName: `Album ${overrides.id}`,
  title: `Album ${overrides.id}`,
  releaseDate: "2024-01-01",
  monitored: false,
  statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
  ...overrides,
});

/** One page of GET /library?kind=tracks holding every song asked for. */
function tracksPage(tracks: object[], albums: Album[] = []) {
  return {
    kind: "tracks",
    page: 1,
    pageSize: 100,
    total: tracks.length,
    hasMore: false,
    items: [],
    artists: [],
    albums,
    tracks,
    genres: [],
  };
}

const defaultAlbumHook = {
  data: undefined,
  isLoading: false,
  error: null,
  refetch: jest.fn().mockResolvedValue({}),
  isRefetching: false,
};

const defaultArtistHook = {
  data: undefined,
  isLoading: false,
  error: null,
  refetch: jest.fn().mockResolvedValue({}),
  isRefetching: false,
};

let consoleErrorSpy: jest.SpyInstance | undefined;
beforeEach(() => {
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({
    mbid: "0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  });
  mockUseLibraryArtist.mockReturnValue({
    ...defaultArtistHook,
    data: baseArtist,
  });
  mockUseCanonicalArtist.mockReturnValue({
    data: undefined,
    refetch: jest.fn().mockResolvedValue({}),
  });
  mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook });
  mockUseLibraryLookup.mockReturnValue({
    isInLibrary: () => true,
    isLoading: false,
  });
  mockGetCanonicalLibraryPage.mockResolvedValue(tracksPage([]));
  mockGetPluginActions.mockResolvedValue([NOTE_ARTIST]);
  mockRunPluginAction.mockResolvedValue("Noted");
  (useHasPermission as jest.Mock).mockReturnValue(() => true);
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy?.mockRestore();
});

async function renderErrorBoundary(error: Error, retry = jest.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    retry,
    ...(await render(
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary error={error} retry={retry} />
      </QueryClientProvider>,
    )),
  };
}

describe("ArtistDetailScreen ErrorBoundary", () => {
  it("shows generic failure message for non-404 errors", async () => {
    const { getByText } = await renderErrorBoundary(new Error("fail"));
    expect(getByText("Failed to load artist")).toBeTruthy();
  });

  it("calls retry when Try Again is pressed", async () => {
    const { getByText, retry } = await renderErrorBoundary(new Error("fail"));
    await fireEvent.press(getByText("Try Again"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows not found message when the API returns 404", async () => {
    const { getByText, queryByText } = await renderErrorBoundary(
      new ApiError(404, "Not Found"),
    );
    expect(getByText("Artist not found")).toBeTruthy();
    // No retry button on 404 — re-fetching won't bring the artist back.
    expect(queryByText("Try Again")).toBeNull();
  });
});

describe("ArtistDetailScreen", () => {
  describe("with artist loaded", () => {
    it("loads the hero from the route's cover, then the live record's", async () => {
      setBaseUrl("https://music.example");
      const heroImages = () =>
        screen
          .getAllByTestId("cover-image")
          .map((image) => image.props.accessibilityLabel);
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        mbid: "0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
        coverUrl: "/api/library/artists/7/cover?v=1",
      });

      const { unmount } = await renderScreen();
      expect(heroImages()).toEqual([
        "https://music.example/api/library/artists/7/cover?v=1",
        "https://music.example/api/library/artists/7/cover?v=1",
      ]);
      await unmount();

      mockUseCanonicalArtist.mockReturnValue({
        data: { coverUrl: "/api/library/artists/7/cover?v=2" },
        refetch: jest.fn(),
      });
      await renderScreen();
      expect(heroImages()).toEqual([
        "https://music.example/api/library/artists/7/cover?v=2",
        "https://music.example/api/library/artists/7/cover?v=2",
      ]);
    });

    it("offers neither Add to Library nor the badge until the lookup answers", async () => {
      // Unanswered reads as "not in the library", which flashed Add to Library
      // on a library artist before the badge replaced it.
      mockUseLibraryLookup.mockReturnValue({
        isInLibrary: () => false,
        isLoading: true,
      });

      await renderScreen();
      expect(screen.queryByText("Add to Library")).toBeNull();
      expect(screen.queryByText("In Your Library")).toBeNull();
    });

    it("reads the artist's cover again once its first album is indexed", async () => {
      const refetch = jest.fn().mockResolvedValue({});
      mockUseCanonicalArtist.mockReturnValue({ data: null, refetch });

      await renderScreen();
      expect(refetch).not.toHaveBeenCalled();

      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: [makeAlbum({ id: "1" })],
      });
      await renderScreen();
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    describe("favorite button", () => {
      const canonicalRecord = (userFavorite: boolean) => ({
        data: {
          identityKey: "mbid:0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
          userFavorite,
        },
        isPending: false,
        refetch: jest.fn().mockResolvedValue({}),
      });

      it.each([
        [false, "Add Test Artist to favorites", true],
        [true, "Remove Test Artist from favorites", false],
      ])(
        "toggles the artist when userFavorite is %s",
        async (userFavorite, label, starred) => {
          mockUseCanonicalArtist.mockReturnValue(canonicalRecord(userFavorite));
          const { getByLabelText } = await renderScreen();

          await fireEvent.press(getByLabelText(label));

          expect(updateLibraryFavorites).toHaveBeenCalledWith(
            ["artist:mbid:0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"],
            starred,
          );
        },
      );

      it("fills the heart on the tap, before the server answers", async () => {
        let finishToggle = (_value: unknown) => {};
        (updateLibraryFavorites as jest.Mock).mockReturnValueOnce(
          new Promise((resolve) => {
            finishToggle = resolve;
          }),
        );
        mockUseCanonicalArtist.mockReturnValue(canonicalRecord(false));
        const { getByLabelText, findByLabelText } = await renderScreen();

        await fireEvent.press(getByLabelText("Add Test Artist to favorites"));

        expect(
          await findByLabelText("Remove Test Artist from favorites"),
        ).toBeTruthy();

        // Left pending, the mutation keeps Jest from exiting.
        await act(async () => {
          finishToggle({ changedIds: [] });
        });
      });

      it("hides the heart when the library hasn't indexed the artist", async () => {
        mockUseCanonicalArtist.mockReturnValue({
          data: null,
          isPending: false,
          refetch: jest.fn().mockResolvedValue({}),
        });
        const { queryByLabelText } = await renderScreen();

        expect(queryByLabelText(/to favorites$/)).toBeNull();
      });

      it("holds the heart's place while the artist loads, and ignores a tap", async () => {
        mockUseCanonicalArtist.mockReturnValue({
          data: undefined,
          isPending: true,
          refetch: jest.fn().mockResolvedValue({}),
        });
        const { getByLabelText } = await renderScreen();

        await fireEvent.press(getByLabelText("Add Test Artist to favorites"));

        expect(updateLibraryFavorites).not.toHaveBeenCalled();
      });
    });

    it("names the artist from its library record over the link", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        mbid: "0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
        name: "test artist",
      });
      await renderScreen();
      expect(screen.getAllByText("Test Artist").length).toBeGreaterThan(0);
      expect(screen.queryByText("test artist")).toBeNull();
    });

    it("shows albums section header", async () => {
      const albums = [makeAlbum({ id: "1" })];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText } = await renderScreen();
      expect(getByText("Albums", { exact: false })).toBeTruthy();
    });

    it("shows empty state when no albums", async () => {
      mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook, data: [] });
      const { getByText } = await renderScreen();
      expect(getByText("No albums in library")).toBeTruthy();
    });

    it("shows album count in category header", async () => {
      const albums = [makeAlbum({ id: "1" }), makeAlbum({ id: "2" })];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText } = await renderScreen();
      expect(getByText("Albums", { exact: false })).toBeTruthy();
      expect(getByText("2")).toBeTruthy();
    });

    it("renders album cards in horizontal scroll", async () => {
      const albums = [makeAlbum({ id: "1", albumName: "First Album" })];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText } = await renderScreen();
      expect(getByText("First Album")).toBeTruthy();
    });

    it("limits visible albums to 10 per category", async () => {
      const albums = Array.from({ length: 15 }, (_, i) =>
        makeAlbum({ id: `${i}`, albumName: `Album ${i}` }),
      );
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText, queryByText } = await renderScreen();
      expect(getByText("Album 0")).toBeTruthy();
      expect(getByText("Album 9")).toBeTruthy();
      expect(queryByText("Album 10")).toBeNull();
      expect(getByText("View All")).toBeTruthy();
    });

    it("does not show View All when 10 or fewer albums", async () => {
      const albums = Array.from({ length: 10 }, (_, i) =>
        makeAlbum({ id: `${i}`, albumName: `Album ${i}` }),
      );
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { queryByText } = await renderScreen();
      expect(queryByText("View All")).toBeNull();
    });

    it("navigates to albums grid when category header is pressed", async () => {
      const albums = [makeAlbum({ id: "1" })];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText } = await renderScreen();
      await fireEvent.press(getByText("Albums", { exact: false }));
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/artist/albums" }),
      );
    });

    it("gives owned compilations their own row and full list", async () => {
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: [
          makeAlbum({ id: "1", albumName: "Studio Album" }),
          makeAlbum({
            id: "2",
            albumName: "Greatest Hits",
            secondaryTypes: ["Compilation"],
          }),
        ],
      });
      const { getByText } = await renderScreen();

      expect(getByText("Studio Album")).toBeTruthy();
      await fireEvent.press(getByText("Compilations", { exact: false }));

      expect(getByText("Greatest Hits")).toBeTruthy();
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/artist/albums",
        params: expect.objectContaining({
          albumType: "Compilation",
          title: "Compilations",
        }),
      });
    });

    it("sorts albums by release date descending", async () => {
      const albums = [
        makeAlbum({ id: "1", albumName: "Older", releaseDate: "2020-01-01" }),
        makeAlbum({ id: "2", albumName: "Newer", releaseDate: "2024-06-01" }),
      ];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getAllByText } = await renderScreen();
      const albumTexts = getAllByText(/Older|Newer/);
      expect(albumTexts[0].props.children).toBe("Newer");
      expect(albumTexts[1].props.children).toBe("Older");
    });

    it("puts albums without release date last", async () => {
      const albums = [
        makeAlbum({
          id: "1",
          albumName: "No Date",
          releaseDate: undefined as any,
        }),
        makeAlbum({
          id: "2",
          albumName: "Has Date",
          releaseDate: "2024-01-01",
        }),
      ];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getAllByText } = await renderScreen();
      const albumTexts = getAllByText(/No Date|Has Date/);
      expect(albumTexts[0].props.children).toBe("Has Date");
      expect(albumTexts[1].props.children).toBe("No Date");
    });

    it("shows album error with retry", async () => {
      const refetch = jest.fn();
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        error: new Error("fail"),
        refetch,
      });
      const { getByText } = await renderScreen();
      expect(getByText("Failed to load albums")).toBeTruthy();
      await fireEvent.press(getByText("Try Again"));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    describe("playing", () => {
      const queueTrack = (
        id: string,
        title: string,
        album: string,
      ): LibraryQueueTrack => ({
        id,
        title,
        artist: "Test Artist",
        album,
        streamPath: `/library/stream/7/${id}`,
        streamFormat: "flac",
        quality: null,
        durationMs: null,
        artistMbid: null,
        albumMbid: null,
        trackMbid: null,
        libraryTrackId: Number(id),
        libraryAlbumId: 7,
        libraryArtistId: 1,
        artworkUrl: null,
        artworkSource: "album",
      });
      const topTrack = (id: string, title: string): PreviewTrack => ({
        id,
        title,
        album: "Best Of",
        preview_url: `/api/deezer/preview?artist=Test%20Artist&track=${title}`,
        duration_ms: 30_000,
      });
      const queuedIds = () =>
        mockPlayQueueFrom.mock.calls[0][0].map(
          (item: { id: string }) => item.id,
        );

      beforeEach(() => {
        setBaseUrl("https://music.example");
        setAuthToken("token");
        mockGetArtistQueue.mockResolvedValue([
          queueTrack("11", "Opener", "First Album"),
          queueTrack("12", "Hit Song", "First Album"),
        ]);
        mockGetArtistPreviewTracks.mockResolvedValue([
          topTrack("dz-1", "Hit Song"),
          topTrack("dz-2", "Rarity"),
        ]);
      });

      it("plays every Library track by the artist, in album order", async () => {
        const { findByLabelText } = await renderScreen();
        await fireEvent.press(await findByLabelText("Play Test Artist"));

        expect(queuedIds()).toEqual(["11", "12"]);
        expect(mockPlayQueueFrom.mock.calls[0][1]).toBe("11");
        expect(mockSetShuffle).not.toHaveBeenCalled();
      });

      it("turns shuffle on before shuffling the artist", async () => {
        const { findByLabelText } = await renderScreen();
        await fireEvent.press(await findByLabelText("Shuffle Test Artist"));

        expect(mockSetShuffle).toHaveBeenCalledWith(true);
        expect(queuedIds()).toEqual(["11", "12"]);
      });

      it("plays top tracks from the tapped row: Library files where it has them, clips elsewhere", async () => {
        const { findByLabelText } = await renderScreen();
        await fireEvent.press(await findByLabelText("Rarity, preview"));

        expect(queuedIds()).toEqual(["12", "preview:dz-2"]);
        expect(mockPlayQueueFrom.mock.calls[0][1]).toBe("preview:dz-2");
        const clip = mockPlayQueueFrom.mock.calls[0][0][1];
        expect(clip).toMatchObject({
          streamPath: null,
          isPreview: true,
          url: "https://music.example/api/deezer/preview?artist=Test%20Artist&track=Rarity&token=token",
        });
      });

      it("lists five top tracks, queues them all, and opens the rest from Show All", async () => {
        const titles = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];
        mockGetArtistPreviewTracks.mockResolvedValue(
          titles.map((title, index) => topTrack(`dz-${index + 1}`, title)),
        );
        const { findByLabelText, findByText, queryByLabelText } =
          await renderScreen();

        expect(await findByLabelText("Five, preview")).toBeTruthy();
        expect(queryByLabelText("Six, preview")).toBeNull();

        await fireEvent.press(await findByLabelText("One, preview"));
        expect(queuedIds()).toHaveLength(7);

        await fireEvent.press(await findByText("Show All 7"));
        expect(mockPush).toHaveBeenCalledWith({
          pathname: "/artist/top-tracks",
          params: {
            mbid: "0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
            artistName: "Test Artist",
          },
        });
      });
    });

    it("renders bio and external links", async () => {
      const { getByText } = await renderScreen();
      expect(getByText("A test biography.")).toBeTruthy();
      expect(getByText("Last.fm")).toBeTruthy();
      expect(getByText("MusicBrainz")).toBeTruthy();
    });

    it("shows In Your Library label when albums exist", async () => {
      const albums = [makeAlbum({ id: "1" })];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText } = await renderScreen();
      expect(getByText("In Your Library")).toBeTruthy();
    });

    it("shows Albums & Releases section when release groups exist", async () => {
      const {
        useArtistDetails,
      } = require("@/hooks/library/use-artist-details");
      (useArtistDetails as jest.Mock).mockReturnValue({
        data: {
          tags: [],
          bio: "A test biography.",
          "release-groups": [
            {
              id: "rg-1",
              title: "Unreleased EP",
              "first-release-date": "2023-06-01",
              "primary-type": "EP",
              "secondary-types": [],
            },
          ],
        },
        isPending: false,
        isLoading: false,
        error: null,
      });
      const { findByText } = await renderScreen();
      expect(await findByText("Albums & Releases")).toBeTruthy();
      expect(await findByText("Unreleased EP")).toBeTruthy();
    });

    it("opens a row's full list with that row's filter", async () => {
      const {
        useArtistDetails,
      } = require("@/hooks/library/use-artist-details");
      (useArtistDetails as jest.Mock).mockReturnValue({
        data: {
          tags: [],
          bio: null,
          "release-groups": [
            {
              id: "rg-1",
              title: "Greatest Hits",
              "first-release-date": "2023-06-01",
              "primary-type": "Album",
              "secondary-types": ["Compilation"],
            },
          ],
        },
        isPending: false,
        isLoading: false,
        error: null,
      });
      const { findByText } = await renderScreen();

      await fireEvent.press(await findByText("Compilations", { exact: false }));

      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/artist/releases",
        params: {
          artistId: "1",
          artistMbid: "0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
          albumType: "Compilation",
          title: "Compilations",
          artistName: "Test Artist",
        },
      });
    });

    it("leaves albums already in the library out of the release rows", async () => {
      const {
        useArtistDetails,
      } = require("@/hooks/library/use-artist-details");
      const release = {
        "first-release-date": "2023-06-01",
        "primary-type": "Album",
        "secondary-types": [],
      };
      (useArtistDetails as jest.Mock).mockReturnValue({
        data: {
          tags: [],
          bio: null,
          "release-groups": [
            { ...release, id: "mbid-1", title: "Owned Release" },
            { ...release, id: "rg-2", title: "Not Owned" },
          ],
        },
        isPending: false,
        isLoading: false,
        error: null,
      });
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: [makeAlbum({ id: "1", albumName: "Library Copy" })],
      });
      const { findByText, queryByText } = await renderScreen();

      expect(await findByText("Not Owned")).toBeTruthy();
      expect(queryByText("Owned Release")).toBeNull();
    });

    it("does not show Albums & Releases skeleton for in-library artist while details are still loading", async () => {
      const {
        useArtistDetails,
      } = require("@/hooks/library/use-artist-details");
      (useArtistDetails as jest.Mock).mockReturnValue({
        data: undefined,
        isPending: true,
        isLoading: true,
        error: null,
      });
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: [makeAlbum({ id: "1" })],
      });

      const { getByText, queryByText } = await renderScreen();

      // Library albums render as usual.
      expect(getByText("In Your Library")).toBeTruthy();
      expect(queryByText("Albums & Releases")).toBeNull();
    });
  });
});

describe("an artist's plugin actions", () => {
  it("run on a Library artist by its MBID", async () => {
    await renderScreen();

    await fireEvent.press(await screen.findByText("Note this artist"));

    expect(mockRunPluginAction).toHaveBeenCalledWith(NOTE_ARTIST, {
      artistId: "0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    });
  });

  it("aren't offered for an artist outside the Library", async () => {
    mockUseLibraryLookup.mockReturnValue({
      isInLibrary: () => false,
      isLoading: false,
    });
    mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook });

    await renderScreen();

    expect(await screen.findByText("Block Artist")).toBeTruthy();
    expect(screen.queryByText("Note this artist")).toBeNull();
  });
});

describe("the artist's songs", () => {
  const ALBUMS = [
    makeAlbum({ id: "7", albumName: "Second", releaseDate: "2020-01-01" }),
    makeAlbum({ id: "8", albumName: "First", releaseDate: "2010-01-01" }),
  ];
  const song = (id: string, albumId: string, trackNumber: number) => ({
    id,
    mbid: "",
    trackName: `Song ${id}`,
    trackNumber,
    hasFile: true,
    streamPath: `/library/stream/${albumId}/${id}`,
  });
  // Title order, as the server sends it.
  const ALL_SONGS = [
    song("70", "7", 1),
    song("71", "7", 2),
    song("72", "7", 3),
    song("80", "8", 1),
    song("81", "8", 2),
    song("82", "8", 3),
  ];
  const queuedIds = () =>
    mockPlayQueueFrom.mock.calls[0][0].map((item: { id: string }) => item.id);

  let played: object[];
  let favorites: object[];

  beforeEach(() => {
    setBaseUrl("https://music.example");
    setAuthToken("token");
    played = [song("81", "8", 2), song("70", "7", 1)];
    favorites = [];
    mockUseCanonicalArtist.mockReturnValue({
      data: { ...baseArtist, identityKey: "mbid:artist:test" },
      isPending: false,
      refetch: jest.fn().mockResolvedValue({}),
    });
    mockGetArtistQueue.mockResolvedValue([]);
    mockGetArtistPreviewTracks.mockResolvedValue([
      {
        id: "dz-1",
        title: "Hit Song",
        album: "Best Of",
        preview_url: "/api/deezer/preview?artist=Test%20Artist&track=Hit",
        duration_ms: 30_000,
      },
    ]);
    mockGetCanonicalLibraryPage.mockImplementation((params) =>
      Promise.resolve(
        tracksPage(
          params.sort === "plays"
            ? played
            : params.favorite
              ? favorites
              : ALL_SONGS,
          ALBUMS,
        ),
      ),
    );
  });

  async function renderWithSongs() {
    mockGetArtistQueue.mockResolvedValue([
      {
        id: "70",
        title: "Song 70",
        artist: "Test Artist",
        album: "Second",
        streamPath: "/library/stream/7/70",
        streamFormat: "flac",
        quality: null,
        durationMs: null,
        artistMbid: null,
        albumMbid: null,
        trackMbid: null,
        libraryTrackId: 70,
        libraryAlbumId: 7,
        libraryArtistId: 1,
        artworkUrl: null,
        artworkSource: "album",
      },
    ]);
    return await renderScreen();
  }

  it("offers a pill for each view with songs", async () => {
    await renderWithSongs();

    expect(await screen.findByText("Songs")).toBeTruthy();
    expect(
      screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel),
    ).toEqual(["Top Tracks", "Most Played", "All Songs"]);
    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "tracks",
        artistId: "1",
        sort: "plays",
        availableOnly: true,
      }),
    );
  });

  it("plays Most Played from the tapped row", async () => {
    await renderWithSongs();

    await fireEvent.press(
      await screen.findByRole("tab", { name: "Most Played" }),
    );
    await fireEvent.press(await screen.findByLabelText("Song 70"));

    expect(queuedIds()).toEqual(["81", "70"]);
    expect(mockPlayQueueFrom.mock.calls[0][1]).toBe("70");
  });

  it("lists All Songs in album order and opens every one from Show All", async () => {
    await renderWithSongs();

    await fireEvent.press(
      await screen.findByRole("tab", { name: "All Songs" }),
    );
    await fireEvent.press(await screen.findByLabelText("Play all songs"));
    expect(queuedIds()).toEqual(["80", "81", "82", "70", "71", "72"]);
    expect(screen.queryByLabelText("Song 72")).toBeNull();

    await fireEvent.press(screen.getByText("Show All 6"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/artist/songs",
      params: { artistId: "1", order: "album", show: "all" },
    });
  });

  it("opens favorites from Show All filtered to them", async () => {
    favorites = ALL_SONGS;
    await renderWithSongs();

    await fireEvent.press(
      await screen.findByRole("tab", { name: "Favorites" }),
    );
    await fireEvent.press(screen.getByText("Show All 6"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/artist/songs",
      params: { artistId: "1", order: "favorited", show: "favorites" },
    });
  });

  it("keeps Top Tracks alone, with no pills, for an artist outside the Library", async () => {
    mockUseLibraryLookup.mockReturnValue({
      isInLibrary: () => false,
      isLoading: false,
    });
    mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook });

    await renderScreen();

    expect(await screen.findByText("Top Tracks")).toBeTruthy();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(mockGetCanonicalLibraryPage).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "tracks" }),
    );
  });
});

describe.each([
  ["Library", ArtistDetailScreen],
  ["Activity", ActivityArtistScreen],
])("the %s tab's artist page", (_tab, Screen) => {
  it("opens an artist outside the library", async () => {
    // Similar artists, release pages and activity rows link here too, and an
    // artist outside the library has no library record to read.
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      mbid: "0b2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
      name: "Outside Artist",
    });
    mockUseLibraryLookup.mockReturnValue({
      isInLibrary: () => false,
      isLoading: false,
    });
    mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook });

    await renderScreen(Screen);

    expect(screen.getAllByText("Outside Artist").length).toBeGreaterThan(0);
    expect(screen.getByText("Add to Library")).toBeTruthy();
  });
});

describe("a Library artist with no MBID", () => {
  const LIBRARY_ID = "1801056";
  const unmatched: Artist = {
    ...baseArtist,
    id: LIBRARY_ID,
    mbid: "",
    artistName: "Djo",
    identityKey: "name:artist:djo",
    sources: ["readonly"],
  };

  beforeEach(() => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      mbid: LIBRARY_ID,
      name: "Djo",
    });
    mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook });
    mockUseCanonicalArtist.mockReturnValue({
      data: unmatched,
      isPending: false,
      refetch: jest.fn().mockResolvedValue({}),
    });
    mockUseLibraryAlbums.mockReturnValue({
      ...defaultAlbumHook,
      data: [makeAlbum({ id: "5", artistId: LIBRARY_ID, albumName: "Twenty" })],
    });
  });

  it("opens by its Library id with what the Library holds", async () => {
    await renderScreen();

    expect(screen.getAllByText("Djo").length).toBeGreaterThan(0);
    expect(screen.getByText("Twenty")).toBeTruthy();
    expect(mockUseLibraryAlbums).toHaveBeenLastCalledWith(LIBRARY_ID);
    expect(screen.queryByText("Artist not found")).toBeNull();
    expect(screen.queryByText("Add to Library")).toBeNull();
    // These need an MBID, and the metadata routes refuse a Library id.
    expect(screen.queryByText("Block Artist")).toBeNull();
    expect(screen.queryByTestId("artist-tags")).toBeNull();
    expect(screen.queryByText("Top Tracks")).toBeNull();
    expect(mockGetArtistPreviewTracks).not.toHaveBeenCalled();
  });

  it("plays its Library songs in album order", async () => {
    setBaseUrl("https://music.example");
    setAuthToken("token");
    // Untagged files give an album no MBID.
    const album = (id: string, releaseDate: string) =>
      makeAlbum({ id, artistId: LIBRARY_ID, releaseDate, mbid: "" });
    const song = (id: string, albumId: string, trackNumber: number) => ({
      id,
      mbid: "",
      trackName: `Song ${id}`,
      trackNumber,
      hasFile: true,
      streamPath: `/library/stream/${albumId}/${id}`,
    });
    mockGetCanonicalLibraryPage.mockResolvedValue({
      kind: "tracks",
      page: 1,
      pageSize: 100,
      total: 3,
      hasMore: false,
      items: [],
      artists: [unmatched],
      albums: [album("8", "2001-01-01"), album("9", "1999-01-01")],
      tracks: [song("21", "8", 2), song("20", "8", 1), song("30", "9", 1)],
      genres: [],
    });

    await renderScreen();
    await fireEvent.press(await screen.findByLabelText("Play Djo"));

    expect(
      mockPlayQueueFrom.mock.calls[0][0].map((item: { id: string }) => item.id),
    ).toEqual(["30", "20", "21"]);
  });

  it.each([
    [
      "a match",
      {
        id: 1801056,
        mbid: baseArtist.mbid,
        musicbrainzName: "Djo",
        merged: false,
      },
      "Matched Djo to Djo",
      baseArtist.mbid,
    ],
    [
      "a merge",
      { id: 5, mbid: baseArtist.mbid, name: "Djo", merged: true },
      "Merged Djo into Djo",
      baseArtist.mbid,
    ],
    [
      "a removed match",
      { id: 1801056, mbid: null, merged: false },
      "Removed the match from Djo",
      "1801056",
    ],
  ])("follows the artist after %s", async (_kind, result, toast, mbid) => {
    mockMatchResult = { name: "Djo", musicbrainzName: null, ...result };
    await renderScreen();

    await fireEvent.press(screen.getByText("Match Artist"));
    await fireEvent.press(screen.getByText("Save Match"));

    expect(Burnt.toast).toHaveBeenCalledWith({ title: toast, preset: "done" });
    expect(mockSetParams).toHaveBeenCalledWith({ mbid });
  });

  it("rescans the artist's files from its menu", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByText("Rescan Files"));

    expect(mockScan).toHaveBeenCalledWith(
      { artistId: 1801056 },
      {
        started: "Rescanning Djo",
        done: "Rescanned Djo",
        failed: "Couldn't rescan Djo",
      },
    );
  });

  it("offers no match without permission to add artists", async () => {
    (useHasPermission as jest.Mock).mockReturnValue(
      (permission: string) => permission !== "addArtist",
    );

    await renderScreen();

    expect(screen.getByText("Rescan Files")).toBeTruthy();
    expect(screen.queryByText("Match Artist")).toBeNull();
  });

  it("waits for the Library row before picking which page to show", async () => {
    // A matched artist would otherwise flash the Library page first.
    mockUseCanonicalArtist.mockReturnValue({
      data: undefined,
      isPending: true,
      refetch: jest.fn(),
    });

    await renderScreen();

    expect(screen.queryByText("Twenty")).toBeNull();
    expect(mockGetCanonicalLibraryPage).not.toHaveBeenCalled();
  });

  it("shows Artist not found for a Library id the Library doesn't hold", async () => {
    mockUseCanonicalArtist.mockReturnValue({
      data: null,
      isPending: false,
      refetch: jest.fn(),
    });

    await renderScreen();

    expect(screen.getByText("Artist not found")).toBeTruthy();
  });

  it("opens the full page once Aurral has matched the artist", async () => {
    // A link made by Library id, such as an album's, to an artist with an MBID.
    mockUseCanonicalArtist.mockReturnValue({
      data: { ...unmatched, mbid: baseArtist.mbid },
      isPending: false,
      refetch: jest.fn().mockResolvedValue({}),
    });
    mockUseLibraryArtist.mockReturnValue({
      ...defaultArtistHook,
      data: baseArtist,
    });

    await renderScreen();

    expect(mockUseLibraryArtist).toHaveBeenLastCalledWith(baseArtist.mbid);
    expect(await screen.findByText("Block Artist")).toBeTruthy();
  });
});
