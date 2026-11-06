jest.mock("@/lib/api/library", () => ({
  deleteAlbum: jest.fn(() => Promise.resolve({})),
  triggerAlbumSearch: jest.fn(() => Promise.resolve({})),
  getDownloadStatuses: jest.fn(() => Promise.resolve({})),
  updateLibraryFavorites: jest.fn(() => Promise.resolve({})),
  favoriteEntityId: jest.requireActual("@/lib/api/library").favoriteEntityId,
}));

jest.mock("@/hooks/library/use-library-albums", () => ({
  useLibraryAlbum: jest.fn(),
}));

jest.mock("@/hooks/library/use-library-tracks", () => ({
  useLibraryTracks: jest.fn(() => ({ data: [], isLoading: false })),
}));

jest.mock("@/hooks/library/use-cover-art-url", () => ({
  useCoverArtUrl: jest.fn(() => ({ url: null, isLoading: false })),
}));

jest.mock("@/hooks/library/use-play-track", () => ({
  usePlayTrack: jest.fn(() => jest.fn()),
}));

const mockPlayAlbum = jest.fn();
const mockShuffleAlbum = jest.fn();
jest.mock("@/hooks/library/use-queue-actions", () => ({
  useQueueActions: jest.fn(() => ({
    playNext: jest.fn(),
    addToQueue: jest.fn(),
    playAlbum: (...args: unknown[]) => mockPlayAlbum(...args),
    shuffleAlbum: (...args: unknown[]) => mockShuffleAlbum(...args),
  })),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Warning: "warning" },
}));

let mockParams: Record<string, string> = {};
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
  const Toolbar = Object.assign(Passthrough, { Menu: Passthrough, MenuAction });
  return {
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
    Stack: { Screen: () => null, Toolbar },
  };
});

jest.mock("expo-router/react-navigation", () => ({
  useHeaderHeight: () => 0,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { ScrollView } = require("react-native");
  return {
    __esModule: true,
    default: {
      ScrollView: React.forwardRef(function MockScrollView(
        props: any,
        ref: any,
      ) {
        return React.createElement(ScrollView, { ...props, ref });
      }),
    },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedScrollHandler: () => () => {},
  };
});

jest.mock("@/components/artist/ArtistDetailLayout", () => ({
  ScrollHeaderTitle: () => null,
}));

jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: jest.fn(() => null),
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
import { Alert } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlbumDetailScreen } from "@/components/library/AlbumDetailScreen";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { useLibraryAlbum } from "@/hooks/library/use-library-albums";
import { useLibraryTracks } from "@/hooks/library/use-library-tracks";
import {
  deleteAlbum,
  getDownloadStatuses,
  triggerAlbumSearch,
  updateLibraryFavorites,
} from "@/lib/api/library";
import { albumRouteParams } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";
import type { Album, Track } from "@/lib/types/library";

const mockUseLibraryAlbum = useLibraryAlbum as jest.Mock;
const mockUseLibraryTracks = useLibraryTracks as jest.Mock;
const mockDeleteAlbum = deleteAlbum as jest.Mock;
const mockTriggerAlbumSearch = triggerAlbumSearch as jest.Mock;
const mockGetDownloadStatuses = getDownloadStatuses as jest.Mock;
const mockCoverArtImage = CoverArtImage as unknown as jest.Mock;
const mockUpdateLibraryFavorites = updateLibraryFavorites as jest.Mock;

// A Lidarr-backed album whose canonical id and Lidarr id differ, the case
// where sending the wrong one acts on a different album.
const lidarrAlbum: Album = {
  id: "14",
  canonicalId: "14",
  lidarrId: "301",
  artistId: "7",
  artistName: "Radiohead",
  mbid: "rg-1",
  foreignAlbumId: "rg-1",
  albumName: "In Rainbows",
  title: "In Rainbows",
  releaseDate: "2007-10-10",
  monitored: true,
  statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
};

/** Open the page the way every caller does: through albumRouteParams. */
async function openAlbumPage(album: Album) {
  mockParams = albumRouteParams(album, "Radiohead", "artist-mb");
  mockUseLibraryAlbum.mockReturnValue({ data: album });
  const queryClient = new QueryClient({
    // React Query's default 5-minute gc timer outlives the test and keeps
    // Jest from exiting. Infinity skips the timer; mutations use 0, as in
    // flow-edit-test.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <AlbumDetailScreen />
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLibraryTracks.mockReturnValue({ data: [], isLoading: false });
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("AlbumDetailScreen", () => {
  it("sends Lidarr's album id, not the canonical id, to re-search and delete", async () => {
    await openAlbumPage(lidarrAlbum);

    await act(async () => {
      fireEvent.press(screen.getByText("Re-search"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Delete Album"));
    });

    expect(mockTriggerAlbumSearch).toHaveBeenCalledWith("301");
    expect(mockDeleteAlbum).toHaveBeenCalledWith("301");
  });

  it("refreshes the whole-library album list and genre counts after a delete", async () => {
    const queryClient = await openAlbumPage(lidarrAlbum);
    // The screens the page was opened from, still counting the album.
    const albumsView = libraryKeys.albumsAll({
      genre: "",
      query: "",
      sort: "name",
      direction: "asc",
    });
    queryClient.setQueryData(albumsView, { pages: [], pageParams: [] });
    queryClient.setQueryData(libraryKeys.genres(), []);

    await act(async () => {
      fireEvent.press(screen.getByText("Delete Album"));
    });

    expect(queryClient.getQueryState(albumsView)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(libraryKeys.genres())?.isInvalidated).toBe(
      true,
    );
  });

  describe("favorites", () => {
    const track: Track = {
      id: "100",
      mbid: "",
      trackName: "Nude",
      title: "Nude",
      trackNumber: 3,
      hasFile: true,
      size: 0,
      quality: null,
      identityKey: "recording:nude",
    };

    async function openTrackMenu(overrides: Partial<Track> = {}) {
      mockUseLibraryTracks.mockReturnValue({
        data: [{ ...track, ...overrides }],
        isLoading: false,
      });
      const queryClient = await openAlbumPage(lidarrAlbum);
      await fireEvent.press(screen.getByLabelText("More actions for Nude"));
      return queryClient;
    }

    it("stars a track from its three dots, by the id the server uses", async () => {
      await openTrackMenu({ userFavorite: false });

      await act(async () => {
        fireEvent.press(screen.getByText("Add to Favorites"));
      });

      expect(mockUpdateLibraryFavorites).toHaveBeenCalledWith(
        ["song:recording:nude"],
        true,
      );
    });

    it("offers to remove a track that is already a favorite", async () => {
      await openTrackMenu({ userFavorite: true });

      await act(async () => {
        fireEvent.press(screen.getByText("Remove from Favorites"));
      });

      expect(mockUpdateLibraryFavorites).toHaveBeenCalledWith(
        ["song:recording:nude"],
        false,
      );
    });

    const favoriteAlbum: Album = {
      ...lidarrAlbum,
      identityKey: "release-group:in-rainbows",
      userFavorite: false,
    };

    it.each([
      [false, "Add In Rainbows to favorites", true],
      [true, "Remove In Rainbows from favorites", false],
    ])(
      "toggles the whole album from the heart beside Play when userFavorite is %s",
      async (userFavorite, label, starred) => {
        await openAlbumPage({ ...favoriteAlbum, userFavorite });

        await act(async () => {
          fireEvent.press(screen.getByLabelText(label));
        });

        expect(mockUpdateLibraryFavorites).toHaveBeenCalledWith(
          ["album:release-group:in-rainbows"],
          starred,
        );
      },
    );

    it("fills the heart on the tap, before the server answers", async () => {
      let finishToggle = (_value: unknown) => {};
      mockUpdateLibraryFavorites.mockReturnValueOnce(
        new Promise((resolve) => {
          finishToggle = resolve;
        }),
      );
      await openAlbumPage(favoriteAlbum);

      await act(async () => {
        fireEvent.press(screen.getByLabelText("Add In Rainbows to favorites"));
      });

      expect(
        screen.getByLabelText("Remove In Rainbows from favorites"),
      ).toBeTruthy();

      // Left pending, the mutation keeps Jest from exiting.
      await act(async () => {
        finishToggle({});
      });
    });

    it("empties the heart again when the server refuses", async () => {
      mockUpdateLibraryFavorites.mockRejectedValueOnce(new Error("refused"));
      await openAlbumPage(favoriteAlbum);

      await act(async () => {
        fireEvent.press(screen.getByLabelText("Add In Rainbows to favorites"));
      });

      expect(
        screen.getByLabelText("Add In Rainbows to favorites"),
      ).toBeTruthy();
    });

    it("hides the heart when the canonical record cannot name the album", async () => {
      await openAlbumPage(lidarrAlbum);

      expect(screen.queryByLabelText(/to favorites$/)).toBeNull();
    });

    it("holds the heart's place while the album loads, and ignores a tap", async () => {
      const queryClient = await openAlbumPage(lidarrAlbum);
      mockUseLibraryAlbum.mockReturnValue({ data: undefined, isPending: true });
      await screen.rerender(
        <QueryClientProvider client={queryClient}>
          <AlbumDetailScreen />
        </QueryClientProvider>,
      );

      await act(async () => {
        fireEvent.press(screen.getByLabelText(/to favorites$/));
      });

      expect(mockUpdateLibraryFavorites).not.toHaveBeenCalled();
    });

    it("refreshes every cached favorite flag and the favorites list after a toggle", async () => {
      const queryClient = await openTrackMenu();
      const keys = [
        libraryKeys.tracks("14"),
        libraryKeys.album("14"),
        libraryKeys.canonicalArtist("artist-mb"),
        libraryKeys.favorites(),
      ];
      keys.forEach((key) => queryClient.setQueryData(key, []));

      await act(async () => {
        fireEvent.press(screen.getByText("Add to Favorites"));
      });

      keys.forEach((key) => {
        expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
      });
    });
  });

  it("reads the download status badge by Lidarr's album id", async () => {
    mockGetDownloadStatuses.mockImplementation(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, { status: "downloading" }])),
    );

    await openAlbumPage(lidarrAlbum);

    expect(await screen.findByText("Downloading...")).toBeTruthy();
    expect(mockGetDownloadStatuses).toHaveBeenCalledWith(["301"]);
  });

  it("loads the hero cover from the server's artwork path, from the live record once it loads", async () => {
    // No MBID, so the server's path is the only way to a cover.
    const row: Album = {
      ...lidarrAlbum,
      mbid: "",
      coverUrl: "/api/library/artwork/album/14?v=1",
    };
    mockParams = albumRouteParams(row, "Radiohead", "artist-mb");
    mockUseLibraryAlbum.mockReturnValue({ data: undefined });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const page = () => (
      <QueryClientProvider client={queryClient}>
        <AlbumDetailScreen />
      </QueryClientProvider>
    );
    const heroCoverUrl = () => mockCoverArtImage.mock.lastCall?.[0].coverUrl;

    const { rerender } = await render(page());
    expect(heroCoverUrl()).toBe("/api/library/artwork/album/14?v=1");

    // The artwork changed on the server after the row was read.
    mockUseLibraryAlbum.mockReturnValue({
      data: { ...row, coverUrl: "/api/library/artwork/album/14?v=2" },
    });
    await rerender(page());
    expect(heroCoverUrl()).toBe("/api/library/artwork/album/14?v=2");
  });

  it("hands the player the album's cover", async () => {
    mockUseLibraryTracks.mockReturnValue({
      data: [
        {
          id: "1",
          mbid: "",
          trackName: "Reckoner",
          title: "Reckoner",
          trackNumber: 1,
          hasFile: true,
          size: 1,
          quality: null,
          streamPath: "/library/canonical-stream/14/1",
        },
      ],
      isLoading: false,
    });
    await openAlbumPage({
      ...lidarrAlbum,
      coverUrl: "/api/library/albums/14/cover?v=1",
    });

    await fireEvent.press(screen.getByText("Play"));

    expect(mockPlayAlbum).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        coverPath: "/api/library/albums/14/cover?v=1",
      }),
    );
  });

  it("shuffles the album from the icon-only button", async () => {
    const tracks = [{ id: "1", trackName: "Nude", hasFile: true }];
    mockUseLibraryTracks.mockReturnValue({ data: tracks, isLoading: false });
    await openAlbumPage(lidarrAlbum);

    await fireEvent.press(screen.getByLabelText("Shuffle In Rainbows"));

    expect(mockShuffleAlbum).toHaveBeenCalledWith(tracks, expect.anything());
  });

  it("hides the Lidarr actions for an album Lidarr does not manage", async () => {
    await openAlbumPage({ ...lidarrAlbum, lidarrId: undefined });

    // The menu itself renders; only the Lidarr actions are gone.
    expect(screen.getByText("View on Last.fm")).toBeTruthy();
    expect(screen.queryByText("Re-search")).toBeNull();
    expect(screen.queryByText("Delete Album")).toBeNull();
    expect(mockGetDownloadStatuses).not.toHaveBeenCalled();
  });
});
