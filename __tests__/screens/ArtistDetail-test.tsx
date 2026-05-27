jest.mock("@/lib/api/library", () => ({
  deleteLibraryArtist: jest.fn(),
  refreshLibraryArtist: jest.fn(),
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
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (val: number) => ({ value: val }),
    useAnimatedScrollHandler: () => () => {},
    withRepeat: jest.fn(),
    withTiming: jest.fn(),
    interpolate: () => 0,
  };
});

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
  const Toolbar = Object.assign(() => null, {
    Menu: () => null,
    MenuAction: () => null,
    Button: () => null,
  });
  return {
    useLocalSearchParams: jest.fn(() => ({ mbid: "abc-123" })),
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

jest.mock("@/components/library/AlbumSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AlbumSheet: function MockAlbumSheet() {
      return React.createElement(View, { testID: "album-sheet" });
    },
  };
});

jest.mock("@/components/library/ReleaseGroupSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    ReleaseGroupSheet: function MockReleaseGroupSheet() {
      return React.createElement(View, { testID: "release-group-sheet" });
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
  useLibraryArtistSuspense: jest.fn(),
}));

jest.mock("@/hooks/library/use-library-albums", () => ({
  useLibraryAlbums: jest.fn(),
}));

jest.mock("@/hooks/library/use-albums-with-types", () => ({
  useAlbumsWithTypes: jest.fn((_mbid: string, albums: any[]) => ({
    albums: albums?.map((a: any) => ({
      ...a,
      albumType: "Album",
      secondaryTypes: [],
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

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ArtistDetailScreen, {
  ErrorBoundary,
} from "@/app/(app)/(tabs)/(library)/artist/[mbid]";
import {
  useLibraryArtist,
  useLibraryArtistSuspense,
} from "@/hooks/library/use-library-artist";
import { useLibraryAlbums } from "@/hooks/library/use-library-albums";
import { usePreviewPlayer } from "@/hooks/library/use-preview-player";
import { ApiError } from "@/lib/api/client";
import type { Artist, Album } from "@/lib/types/library";

const mockUsePreviewPlayer = usePreviewPlayer as jest.Mock;
const mockUseLibraryArtistSuspense = useLibraryArtistSuspense as jest.Mock;

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ArtistDetailScreen />
    </QueryClientProvider>,
  );
}

const mockUseLibraryArtist = useLibraryArtist as jest.Mock;
const mockUseLibraryAlbums = useLibraryAlbums as jest.Mock;

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

const defaultSuspenseHook = {
  data: baseArtist,
  refetch: jest.fn().mockResolvedValue({ isError: false }),
  isRefetching: false,
};

let consoleErrorSpy: jest.SpyInstance | undefined;
beforeEach(() => {
  jest.clearAllMocks();
  mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook });
  mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook });
  mockUseLibraryArtistSuspense.mockReturnValue({ ...defaultSuspenseHook });
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy?.mockRestore();
});

function renderErrorBoundary(error: Error, retry = jest.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    retry,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary error={error} retry={retry} />
      </QueryClientProvider>,
    ),
  };
}

describe("ArtistDetailScreen ErrorBoundary", () => {
  it("shows generic failure message for non-404 errors", () => {
    const { getByText } = renderErrorBoundary(new Error("fail"));
    expect(getByText("Failed to load artist")).toBeTruthy();
  });

  it("calls retry when Try Again is pressed", () => {
    const { getByText, retry } = renderErrorBoundary(new Error("fail"));
    fireEvent.press(getByText("Try Again"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows not found message when the API returns 404", () => {
    const { getByText, queryByText } = renderErrorBoundary(
      new ApiError(404, "Not Found"),
    );
    expect(getByText("Artist not found")).toBeTruthy();
    // No retry button on 404 — re-fetching won't bring the artist back.
    expect(queryByText("Try Again")).toBeNull();
  });
});

describe("ArtistDetailScreen", () => {
  describe("with artist loaded", () => {
    it("renders artist name", () => {
      const { getByText } = renderScreen();
      expect(getByText("Test Artist")).toBeTruthy();
    });

    it("shows albums section header", () => {
      const albums = [makeAlbum({ id: "1" })];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText } = renderScreen();
      expect(getByText("Albums", { exact: false })).toBeTruthy();
    });

    it("shows empty state when no albums", () => {
      mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook, data: [] });
      const { getByText } = renderScreen();
      expect(getByText("No albums in library")).toBeTruthy();
    });

    it("shows album count in category header", () => {
      const albums = [makeAlbum({ id: "1" }), makeAlbum({ id: "2" })];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText } = renderScreen();
      expect(getByText("Albums", { exact: false })).toBeTruthy();
      expect(getByText("2")).toBeTruthy();
    });

    it("renders album cards in horizontal scroll", () => {
      const albums = [makeAlbum({ id: "1", albumName: "First Album" })];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText } = renderScreen();
      expect(getByText("First Album")).toBeTruthy();
    });

    it("limits visible albums to 10 per category", () => {
      const albums = Array.from({ length: 15 }, (_, i) =>
        makeAlbum({ id: `${i}`, albumName: `Album ${i}` }),
      );
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText, queryByText } = renderScreen();
      expect(getByText("Album 0")).toBeTruthy();
      expect(getByText("Album 9")).toBeTruthy();
      expect(queryByText("Album 10")).toBeNull();
      expect(getByText("View All")).toBeTruthy();
    });

    it("does not show View All when 10 or fewer albums", () => {
      const albums = Array.from({ length: 10 }, (_, i) =>
        makeAlbum({ id: `${i}`, albumName: `Album ${i}` }),
      );
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { queryByText } = renderScreen();
      expect(queryByText("View All")).toBeNull();
    });

    it("navigates to albums grid when category header is pressed", () => {
      const albums = [makeAlbum({ id: "1" })];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getByText } = renderScreen();
      fireEvent.press(getByText("Albums", { exact: false }));
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/artist/albums" }),
      );
    });

    it("sorts albums by release date descending", () => {
      const albums = [
        makeAlbum({ id: "1", albumName: "Older", releaseDate: "2020-01-01" }),
        makeAlbum({ id: "2", albumName: "Newer", releaseDate: "2024-06-01" }),
      ];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getAllByText } = renderScreen();
      const albumTexts = getAllByText(/Older|Newer/);
      expect(albumTexts[0].props.children).toBe("Newer");
      expect(albumTexts[1].props.children).toBe("Older");
    });

    it("puts albums without release date last", () => {
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
      const { getAllByText } = renderScreen();
      const albumTexts = getAllByText(/No Date|Has Date/);
      expect(albumTexts[0].props.children).toBe("Has Date");
      expect(albumTexts[1].props.children).toBe("No Date");
    });

    it("shows album error with retry", () => {
      const refetch = jest.fn();
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        error: new Error("fail"),
        refetch,
      });
      const { getByText } = renderScreen();
      expect(getByText("Failed to load albums")).toBeTruthy();
      fireEvent.press(getByText("Try Again"));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("renders top tracks when available", () => {
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
      const { getByText } = renderScreen();
      expect(getByText("Top Tracks")).toBeTruthy();
      expect(getByText("Hit Song")).toBeTruthy();
    });

    it("renders bio and external links", () => {
      const { getByText } = renderScreen();
      expect(getByText("A test biography.")).toBeTruthy();
      expect(getByText("Last.fm")).toBeTruthy();
      expect(getByText("MusicBrainz")).toBeTruthy();
    });

    it("shows In Your Library label when albums exist", () => {
      const albums = [makeAlbum({ id: "1" })];
      mockUseLibraryAlbums.mockReturnValue({
        ...defaultAlbumHook,
        data: albums,
      });
      const { getAllByText } = renderScreen();
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
      const { findByText } = renderScreen();
      expect(await findByText("Albums & Releases")).toBeTruthy();
      expect(await findByText("Unreleased EP")).toBeTruthy();
    });

    it("does not show Albums & Releases skeleton for in-library artist while stream is still loading", () => {
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

      const { queryAllByText, queryByText } = renderScreen();

      // Library albums render as usual (label appears in hero and section)
      expect(queryAllByText("In Your Library").length).toBeGreaterThanOrEqual(
        2,
      );
      // But the "Other Releases" skeleton/header is suppressed while streaming
      expect(queryByText("Albums & Releases")).toBeNull();
    });
  });
});
