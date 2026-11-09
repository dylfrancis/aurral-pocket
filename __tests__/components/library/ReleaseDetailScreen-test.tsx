jest.mock("@/lib/api/library", () => ({
  addLibraryAlbum: jest.fn(),
  getLibraryArtistId: jest.fn(() => Promise.resolve(null)),
  getReleaseGroupTracks: jest.fn(() => Promise.resolve([])),
  requestAlbumFromSearch: jest.fn(),
  searchDeezerAlbum: jest.fn(() => Promise.resolve(null)),
  triggerAlbumSearch: jest.fn(),
}));

jest.mock("burnt", () => ({ toast: jest.fn() }));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => () => true,
}));

jest.mock("@/hooks/library/use-audio-preview", () => ({
  useAudioPreview: () => ({
    playingId: null,
    loadingId: null,
    progress: 0,
    toggle: jest.fn(),
    stop: jest.fn(),
  }),
}));

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn() }),
  Stack: { Screen: () => null },
}));

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
import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { ReleaseDetailScreen } from "@/components/library/ReleaseDetailScreen";
import { addLibraryAlbum } from "@/lib/api/library";

const mockAddLibraryAlbum = addLibraryAlbum as jest.Mock;
const mockToast = Burnt.toast as jest.Mock;

let client: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  // Infinity schedules no gc timer, which would hold Jest open.
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
});

afterEach(() => {
  client.clear();
});

describe("ReleaseDetailScreen", () => {
  it("says when an unreleased album will download once it is requested", async () => {
    mockParams = {
      mbid: "rg-9",
      title: "Kid B",
      artistName: "Radiohead",
      artistMbid: "artist-mb",
      artistId: "7",
      releaseDate: "2027-03-05",
    };
    mockAddLibraryAlbum.mockResolvedValue({
      albumStatus: { status: "unreleased", releaseDate: "2027-03-05" },
    });
    await render(
      <QueryClientProvider client={client}>
        <ReleaseDetailScreen />
      </QueryClientProvider>,
    );

    await fireEvent.press(screen.getByText("Add Album"));

    expect(mockAddLibraryAlbum).toHaveBeenCalledWith("7", "rg-9", "Kid B");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Downloads Mar 5, 2027" }),
    );
  });
});
