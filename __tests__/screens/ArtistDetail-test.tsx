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
  refreshLibraryArtist: jest.fn(),
  updateLibraryFavorites: jest.fn(() => Promise.resolve({ changedIds: [] })),
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
  useCoverArtUrl: jest.fn(() => ({
    url: "https://example.com/art.jpg",
    isLoading: false,
  })),
}));

const mockPush = jest.fn();
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
      mbid: "abc-123",
    })),
    useRouter: jest.fn(() => ({ back: jest.fn(), push: mockPush })),
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

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  const BottomSheet = React.forwardRef(function MockBottomSheet(
    { children, ...props }: any,
    ref: any,
  ) {
    React.useImperativeHandle(ref, () => ({
      close: jest.fn(),
      snapToIndex: jest.fn(),
      present: jest.fn(),
      dismiss: jest.fn(),
    }));
    return React.createElement(View, props, children);
  });
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetModal: BottomSheet,
    BottomSheetBackdrop: (props: any) => React.createElement(View, props),
    BottomSheetScrollView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
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

jest.mock("@/hooks/search/use-similar-artists", () => ({
  useSimilarArtists: jest.fn(() => ({ data: [] })),
}));

jest.mock("@/hooks/search/use-library-lookup", () => ({
  useLibraryLookup: jest.fn(() => ({
    isInLibrary: () => true,
    libraryArtists: [],
  })),
}));

jest.mock("@/hooks/library/use-artist-details-stream", () => ({
  useArtistDetailsStream: jest.fn(() => ({
    data: {
      tags: [],
      bio: "A test biography.",
      releaseGroups: [],
      isComplete: true,
    },
    isLoading: false,
    error: null,
  })),
}));

jest.mock("@/hooks/library/use-preview-player", () => ({
  usePreviewPlayer: jest.fn(() => ({
    tracks: [],
    isLoading: false,
    playingId: null,
    progress: 0,
    toggle: jest.fn(),
    stop: jest.fn(),
  })),
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

const mockLidarrConfigured = jest.fn(() => true);
jest.mock("@/hooks/auth/use-lidarr-configured", () => ({
  useLidarrConfigured: () => mockLidarrConfigured(),
}));

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { updateLibraryFavorites } from "@/lib/api/library";
import ArtistDetailScreen, {
  ErrorBoundary,
} from "@/app/(app)/(tabs)/(library)/artist/[mbid]";
import ActivityArtistScreen from "@/app/(app)/(tabs)/(activity)/artist/[mbid]";
import {
  useCanonicalArtist,
  useLibraryArtist,
} from "@/hooks/library/use-library-artist";
import { useLibraryAlbums } from "@/hooks/library/use-library-albums";
import { usePreviewPlayer } from "@/hooks/library/use-preview-player";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { ApiError, setBaseUrl } from "@/lib/api/client";
import type { Artist, Album } from "@/lib/types/library";

const mockUsePreviewPlayer = usePreviewPlayer as jest.Mock;

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

const baseArtist: Artist = {
  id: "1",
  mbid: "abc-123",
  foreignArtistId: "abc-123",
  artistName: "Test Artist",
  monitored: true,
  monitorOption: "all",
  addedAt: "2024-01-01",
  statistics: { albumCount: 2, trackCount: 20, sizeOnDisk: 1000 },
};

const makeAlbum = (overrides: Partial<Album> & { id: string }): Album => ({
  artistId: "1",
  artistName: "Test Artist",
  mbid: `mbid-${overrides.id}`,
  foreignAlbumId: `fid-${overrides.id}`,
  albumName: `Album ${overrides.id}`,
  title: `Album ${overrides.id}`,
  releaseDate: "2024-01-01",
  monitored: false,
  statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
  ...overrides,
});

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
  mockLidarrConfigured.mockReturnValue(true);
  (useLocalSearchParams as jest.Mock).mockReturnValue({
    mbid: "abc-123",
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
  // The server's refresh only asks Lidarr to search the artist.
  it.each([
    ["an artist with no owner on record", true, { managedBy: null }, true],
    ["an Aurral-managed artist", true, { managedBy: "aurral" }, false],
    ["a server without Lidarr", false, { managedBy: null }, false],
    ["an artist still loading", true, undefined, false],
  ] as const)(
    "offers Refresh for %s: %p/%p/%p",
    async (_case, connected, artist, offered) => {
      mockLidarrConfigured.mockReturnValue(connected);
      mockUseLibraryArtist.mockReturnValue({
        ...defaultArtistHook,
        data: artist && { ...baseArtist, ...artist },
      });
      await renderScreen();

      expect(screen.queryByText("Refresh") !== null).toBe(offered);
    },
  );

  describe("with artist loaded", () => {
    it("loads the hero from the route's cover, then the live record's", async () => {
      setBaseUrl("https://music.example");
      const heroImages = () =>
        screen
          .getAllByTestId("cover-image")
          .map((image) => image.props.accessibilityLabel);
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        mbid: "abc-123",
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
          identityKey: "mbid:abc-123",
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
            ["artist:mbid:abc-123"],
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
        mbid: "abc-123",
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

    it("renders top tracks when available", async () => {
      mockUsePreviewPlayer.mockReturnValue({
        tracks: [
          {
            id: "t1",
            title: "Hit Song",
            album: "Best Of",
            preview_url: "https://example.com/preview.mp3",
          },
        ],
        isLoading: false,
        playingId: null,
        progress: 0,
        toggle: jest.fn(),
        stop: jest.fn(),
      });
      const { getByText } = await renderScreen();
      expect(getByText("Top Tracks")).toBeTruthy();
      expect(getByText("Hit Song")).toBeTruthy();
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
      const { getAllByText } = await renderScreen();
      // One from LibraryBadge in hero, one from section label
      expect(getAllByText("In Your Library").length).toBeGreaterThanOrEqual(2);
    });

    it("shows Albums & Releases section when release groups exist", async () => {
      const {
        useArtistDetailsStream,
      } = require("@/hooks/library/use-artist-details-stream");
      (useArtistDetailsStream as jest.Mock).mockReturnValue({
        data: {
          tags: [],
          bio: "A test biography.",
          releaseGroups: [
            {
              id: "rg-1",
              title: "Unreleased EP",
              "first-release-date": "2023-06-01",
              "primary-type": "EP",
              "secondary-types": [],
            },
          ],
          isComplete: true,
        },
        isLoading: false,
        error: null,
      });
      const { findByText } = await renderScreen();
      expect(await findByText("Albums & Releases")).toBeTruthy();
      expect(await findByText("Unreleased EP")).toBeTruthy();
    });

    it("opens a row's full list with that row's filter", async () => {
      const {
        useArtistDetailsStream,
      } = require("@/hooks/library/use-artist-details-stream");
      (useArtistDetailsStream as jest.Mock).mockReturnValue({
        data: {
          tags: [],
          bio: null,
          releaseGroups: [
            {
              id: "rg-1",
              title: "Greatest Hits",
              "first-release-date": "2023-06-01",
              "primary-type": "Album",
              "secondary-types": ["Compilation"],
            },
          ],
          isComplete: true,
        },
        isLoading: false,
        error: null,
      });
      const { findByText } = await renderScreen();

      await fireEvent.press(await findByText("Compilations", { exact: false }));

      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/artist/releases",
        params: {
          artistId: "1",
          artistMbid: "abc-123",
          albumType: "Compilation",
          title: "Compilations",
          artistName: "Test Artist",
        },
      });
    });

    it("leaves albums already in the library out of the release rows", async () => {
      const {
        useArtistDetailsStream,
      } = require("@/hooks/library/use-artist-details-stream");
      const release = {
        "first-release-date": "2023-06-01",
        "primary-type": "Album",
        "secondary-types": [],
      };
      (useArtistDetailsStream as jest.Mock).mockReturnValue({
        data: {
          tags: [],
          bio: null,
          releaseGroups: [
            { ...release, id: "mbid-1", title: "Owned Release" },
            { ...release, id: "rg-2", title: "Not Owned" },
          ],
          isComplete: true,
        },
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

    it("does not show Albums & Releases skeleton for in-library artist while stream is still loading", async () => {
      const {
        useArtistDetailsStream,
      } = require("@/hooks/library/use-artist-details-stream");
      (useArtistDetailsStream as jest.Mock).mockReturnValue({
        data: {
          tags: [],
          bio: null,
          releaseGroups: [],
          isComplete: false,
        },
        isLoading: false,
        error: null,
      });
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: [makeAlbum({ id: "1" })],
      });

      const { queryAllByText, queryByText } = await renderScreen();

      // Library albums render as usual (label appears in hero and section)
      expect(queryAllByText("In Your Library").length).toBeGreaterThanOrEqual(
        2,
      );
      // But the "Other Releases" skeleton/header is suppressed while streaming
      expect(queryByText("Albums & Releases")).toBeNull();
    });
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
      mbid: "abc-123",
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
