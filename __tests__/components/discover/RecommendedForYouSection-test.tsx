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
      subtitle,
    }: {
      name: string;
      onPress: () => void;
      subtitle?: string;
    }) =>
      React.createElement(
        Pressable,
        { onPress, testID: `artist-${name}` },
        React.createElement(Text, null, name),
        subtitle
          ? React.createElement(Text, { testID: `subtitle-${name}` }, subtitle)
          : null,
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
import { RecommendedForYouSection } from "@/components/discover/RecommendedForYouSection";
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

describe("RecommendedForYouSection", () => {
  it("shows skeleton while loading", () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true });

    const { queryByTestId } = render(
      <RecommendedForYouSection onArtistPress={jest.fn()} />,
    );

    expect(queryByTestId("skeleton")).toBeTruthy();
  });

  it("returns null when recommendations is empty", () => {
    mockHook.mockReturnValue({
      data: { ...emptyDiscovery },
      isLoading: false,
    });

    const { toJSON } = render(
      <RecommendedForYouSection onArtistPress={jest.fn()} />,
    );

    expect(toJSON()).toBeNull();
  });

  it("renders recommendations and fires onArtistPress", () => {
    const artists = [
      { id: "1", name: "Alpha" },
      { id: "2", name: "Beta", sourceArtist: "Source" },
    ];
    mockHook.mockReturnValue({
      data: { ...emptyDiscovery, recommendations: artists },
      isLoading: false,
    });
    const onPress = jest.fn();

    const { getByText, queryByText } = render(
      <RecommendedForYouSection onArtistPress={onPress} />,
    );

    expect(getByText("Recommended For You")).toBeTruthy();
    expect(queryByText("Similar to Source")).toBeTruthy();

    fireEvent.press(getByText("Alpha"));
    expect(onPress).toHaveBeenCalledWith(artists[0]);
  });
});
