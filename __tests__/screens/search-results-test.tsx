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

jest.mock("@/hooks/search/use-artists-by-tag", () => ({
  useArtistsByTag: jest.fn(() => ({
    data: { recommendations: [], tag: "rock", total: 0, offset: 0 },
    isLoading: false,
    refetch: jest.fn(),
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
import { render, fireEvent } from "@testing-library/react-native";
import SearchResultsScreen from "@/app/(app)/(tabs)/(search)/results";

describe("SearchResultsScreen — empty tag results", () => {
  it('shows "Try searching all" when recommended scope has no results', () => {
    const { getByText } = render(<SearchResultsScreen />);
    expect(getByText("Try searching all")).toBeTruthy();
  });

  it("tapping the button broadens the empty state away", () => {
    const { getByText, queryByText } = render(<SearchResultsScreen />);
    fireEvent.press(getByText("Try searching all"));
    expect(queryByText("Try searching all")).toBeNull();
  });
});
