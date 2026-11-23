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
  useCatalogSearch: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    refetch: jest.fn(),
  })),
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
import { useCatalogSearch } from "@/hooks/search/use-catalog-search";

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseCatalogSearch = useCatalogSearch as jest.Mock;

async function renderResults() {
  return render(
    // Artist rows read their artwork through the cache, and a default gcTime
    // timer would hold the Jest process open for five minutes after the run.
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}
    >
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

describe("SearchResultsScreen — a search from outside Search", () => {
  it("opens on the filter it was sent with", async () => {
    mockUseLocalSearchParams.mockReturnValue({
      q: "massive attack",
      filter: "artists",
    });
    mockUseCatalogSearch.mockReturnValue({
      data: {
        status: "ok",
        artists: [{ id: "a1", name: "Massive Attack" }],
        albums: [],
      },
      isLoading: false,
      isPlaceholderData: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderResults();

    expect(
      screen.getByRole("tab", { name: "Artists" }).props.accessibilityState
        .selected,
    ).toBe(true);
    expect(screen.getByText("Massive Attack")).toBeTruthy();
  });
});
