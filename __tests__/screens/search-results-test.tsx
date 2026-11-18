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
    refetch: jest.fn(),
  })),
}));

jest.mock("@/hooks/search/use-album-search", () => ({
  useAlbumSearch: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    refetch: jest.fn(),
  })),
}));

jest.mock("@/hooks/search/use-artists-by-tag", () => ({
  useArtistsByTag: jest.fn(() => ({
    data: { recommendations: [], tag: "rock", total: 0, offset: 0 },
    isLoading: false,
    refetch: jest.fn(),
  })),
}));

jest.mock("@/hooks/search/use-library-search", () => ({
  useLibrarySearch: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    refetch: jest.fn(),
  })),
}));

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

jest.mock("@/components/library/TrackActionsSheet", () => ({
  ...jest.requireActual("@/components/library/TrackActionsSheet"),
  TrackActionsSheet: () => null,
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
  })),
}));

jest.mock("expo-router", () => ({
  Stack: {
    Toolbar: Object.assign(() => null, {
      Menu: () => null,
      MenuAction: () => null,
    }),
  },
  useLocalSearchParams: jest.fn(() => ({ q: "#rock" })),
  useNavigation: jest.fn(() => ({ setOptions: jest.fn() })),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
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
import { render, fireEvent, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import SearchResultsScreen from "@/app/(app)/(tabs)/(search)/results";
import { useLibrarySearch } from "@/hooks/search/use-library-search";

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseLibrarySearch = useLibrarySearch as jest.Mock;

async function renderResults() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <SearchResultsScreen />
    </QueryClientProvider>,
  );
}

describe("SearchResultsScreen — empty tag results", () => {
  it('shows "Try searching all" when recommended scope has no results', async () => {
    const { getByText } = await renderResults();
    expect(getByText("Try searching all")).toBeTruthy();
  });

  it("tapping the button broadens the empty state away", async () => {
    const { getByText, queryByText } = await renderResults();
    await fireEvent.press(getByText("Try searching all"));
    expect(queryByText("Try searching all")).toBeNull();
  });
});

describe("SearchResultsScreen — songs", () => {
  it("lists the Library songs when See all songs opened it", async () => {
    mockUseLocalSearchParams.mockReturnValue({ q: "karma", scope: "song" });
    mockUseLibrarySearch.mockReturnValue({
      data: {
        tracks: [
          {
            id: "77",
            title: "Karma Police",
            artistName: "Radiohead",
            albumTitle: "OK Computer",
            albumMbid: null,
            libraryAlbumId: "12",
            trackMbid: null,
            artistMbid: null,
            releaseYear: null,
            durationMs: null,
            streamPath: "/library/stream/12/77",
            coverUrl: null,
          },
        ],
        playlists: [],
      },
      isLoading: false,
      refetch: jest.fn(),
    });

    await renderResults();

    expect(mockUseLibrarySearch).toHaveBeenLastCalledWith("karma");
    expect(screen.getByText("Karma Police")).toBeTruthy();
  });
});
