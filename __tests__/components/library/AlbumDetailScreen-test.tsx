jest.mock("@/lib/api/library", () => ({
  deleteAlbum: jest.fn(() => Promise.resolve({})),
  triggerAlbumSearch: jest.fn(() => Promise.resolve({})),
  getDownloadStatuses: jest.fn(() => Promise.resolve({})),
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

jest.mock("@/hooks/library/use-queue-actions", () => ({
  useQueueActions: jest.fn(() => ({
    playNext: jest.fn(),
    addToQueue: jest.fn(),
    playAlbum: jest.fn(),
    shuffleAlbum: jest.fn(),
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
import { Alert } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlbumDetailScreen } from "@/components/library/AlbumDetailScreen";
import { useLibraryAlbum } from "@/hooks/library/use-library-albums";
import {
  deleteAlbum,
  getDownloadStatuses,
  triggerAlbumSearch,
} from "@/lib/api/library";
import { albumRouteParams } from "@/lib/library-read";
import type { Album } from "@/lib/types/library";

const mockUseLibraryAlbum = useLibraryAlbum as jest.Mock;
const mockDeleteAlbum = deleteAlbum as jest.Mock;
const mockTriggerAlbumSearch = triggerAlbumSearch as jest.Mock;
const mockGetDownloadStatuses = getDownloadStatuses as jest.Mock;

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
}

beforeEach(() => {
  jest.clearAllMocks();
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

  it("reads the download status badge by Lidarr's album id", async () => {
    mockGetDownloadStatuses.mockImplementation(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, { status: "downloading" }])),
    );

    await openAlbumPage(lidarrAlbum);

    expect(await screen.findByText("Downloading...")).toBeTruthy();
    expect(mockGetDownloadStatuses).toHaveBeenCalledWith(["301"]);
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
