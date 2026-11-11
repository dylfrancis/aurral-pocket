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
  configured: true,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RecommendedForYouSection", () => {
  it("shows skeleton while loading", async () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true });

    const { queryByTestId } = await render(
      <RecommendedForYouSection onArtistPress={jest.fn()} />,
    );

    expect(queryByTestId("skeleton")).toBeTruthy();
  });

  it("returns null when recommendations is empty", async () => {
    mockHook.mockReturnValue({
      data: { ...emptyDiscovery },
      isLoading: false,
    });

    const { toJSON } = await render(
      <RecommendedForYouSection onArtistPress={jest.fn()} />,
    );

    expect(toJSON()).toBeNull();
  });

  it("renders recommendations, says why each is there and fires onArtistPress", async () => {
    const recommendation = {
      matchedTags: [],
      sourceArtists: [],
      supportingSeeds: [],
      discoveryDepth: 1,
    };
    const artists = [
      { ...recommendation, id: "1", name: "Alpha" },
      {
        ...recommendation,
        id: "2",
        name: "Beta",
        supportingSeeds: [{ artistName: "Slowdive" }],
      },
    ];
    mockHook.mockReturnValue({
      data: {
        ...emptyDiscovery,
        basedOn: [{ name: "Slowdive" }],
        recommendations: artists,
      },
      isLoading: false,
    });
    const onPress = jest.fn();

    const { getByText, queryByText } = await render(
      <RecommendedForYouSection onArtistPress={onPress} />,
    );

    expect(getByText("Recommended For You")).toBeTruthy();
    expect(queryByText("like Slowdive")).toBeTruthy();

    await fireEvent.press(getByText("Alpha"));
    expect(onPress).toHaveBeenCalledWith(artists[0]);
  });
});
