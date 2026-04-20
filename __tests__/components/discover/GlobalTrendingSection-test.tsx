jest.mock("@/hooks/discover", () => ({
  useDiscovery: jest.fn(),
}));

jest.mock("@/hooks/search/use-library-lookup", () => ({
  useLibraryLookup: jest.fn(() => ({
    isInLibrary: () => false,
    libraryArtists: [],
  })),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/components/discover/HorizontalArtistCard", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    HorizontalArtistCard: ({
      name,
      onPress,
    }: {
      name: string;
      onPress: () => void;
    }) =>
      React.createElement(
        Pressable,
        { onPress, testID: `artist-${name}` },
        React.createElement(Text, null, name),
      ),
  };
});

jest.mock("@/components/artist/AlbumCategorySkeleton", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AlbumCategorySkeleton: () =>
      React.createElement(View, { testID: "skeleton" }),
  };
});

import { render, fireEvent } from "@testing-library/react-native";
import { GlobalTrendingSection } from "@/components/discover/GlobalTrendingSection";
import { useDiscovery } from "@/hooks/discover";

const mockHook = useDiscovery as jest.Mock;

const emptyDiscovery = {
  recommendations: [],
  globalTop: [],
  basedOn: [],
  topTags: [],
  topGenres: [],
  lastUpdated: null,
  isUpdating: false,
  configured: true,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GlobalTrendingSection", () => {
  it("shows skeleton while loading", () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true });

    const { queryByTestId } = render(
      <GlobalTrendingSection onArtistPress={jest.fn()} />,
    );

    expect(queryByTestId("skeleton")).toBeTruthy();
  });

  it("returns null when globalTop is empty", () => {
    mockHook.mockReturnValue({
      data: { ...emptyDiscovery },
      isLoading: false,
    });

    const { toJSON } = render(
      <GlobalTrendingSection onArtistPress={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("caps rendered artists at 12", () => {
    const globalTop = Array.from({ length: 15 }, (_, i) => ({
      id: `${i}`,
      name: `A${i}`,
    }));
    mockHook.mockReturnValue({
      data: { ...emptyDiscovery, globalTop },
      isLoading: false,
    });

    const { queryByTestId } = render(
      <GlobalTrendingSection onArtistPress={jest.fn()} />,
    );

    for (let i = 0; i < 12; i++) {
      expect(queryByTestId(`artist-A${i}`)).toBeTruthy();
    }
    expect(queryByTestId("artist-A12")).toBeNull();
  });

  it("fires onArtistPress with the right artist", () => {
    const globalTop = [{ id: "1", name: "Alpha" }];
    mockHook.mockReturnValue({
      data: { ...emptyDiscovery, globalTop },
      isLoading: false,
    });
    const onPress = jest.fn();

    const { getByText } = render(
      <GlobalTrendingSection onArtistPress={onPress} />,
    );

    fireEvent.press(getByText("Alpha"));
    expect(onPress).toHaveBeenCalledWith(globalTop[0]);
  });
});
