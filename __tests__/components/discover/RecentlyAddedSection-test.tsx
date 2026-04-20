jest.mock("@/hooks/discover", () => ({
  useRecentlyAdded: jest.fn(),
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
import { RecentlyAddedSection } from "@/components/discover/RecentlyAddedSection";
import { useRecentlyAdded } from "@/hooks/discover";
import type { RecentlyAddedArtist } from "@/lib/types/search";

const mockHook = useRecentlyAdded as jest.Mock;

const recent = (id: string): RecentlyAddedArtist => ({
  id,
  mbid: `mbid-${id}`,
  foreignArtistId: `mbid-${id}`,
  artistName: `Artist ${id}`,
  addedAt: "2026-04-01T00:00:00Z",
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RecentlyAddedSection", () => {
  it("shows skeleton while loading", () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true });

    const { queryByText, queryByTestId } = render(
      <RecentlyAddedSection onArtistPress={jest.fn()} />,
    );

    expect(queryByText("Recently Added")).toBeTruthy();
    expect(queryByTestId("skeleton")).toBeTruthy();
  });

  it("returns null when data is empty", () => {
    mockHook.mockReturnValue({ data: [], isLoading: false });

    const { queryByText, toJSON } = render(
      <RecentlyAddedSection onArtistPress={jest.fn()} />,
    );

    expect(queryByText("Recently Added")).toBeNull();
    expect(toJSON()).toBeNull();
  });

  it("renders artists and fires onArtistPress", () => {
    const artists = [recent("1"), recent("2")];
    mockHook.mockReturnValue({ data: artists, isLoading: false });
    const onPress = jest.fn();

    const { getByText } = render(
      <RecentlyAddedSection onArtistPress={onPress} />,
    );

    expect(getByText("Recently Added")).toBeTruthy();
    fireEvent.press(getByText("Artist 1"));
    expect(onPress).toHaveBeenCalledWith(artists[0]);
  });
});
