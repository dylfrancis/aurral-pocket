jest.mock("@/hooks/discover", () => ({
  useRecentReleases: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/components/discover/DiscoverReleaseCard", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    DiscoverReleaseCard: ({
      album,
      onPress,
    }: {
      album: { albumName: string };
      onPress: () => void;
    }) =>
      React.createElement(
        Pressable,
        { onPress, testID: `album-${album.albumName}` },
        React.createElement(Text, null, album.albumName),
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
import { RecentReleasesSection } from "@/components/discover/RecentReleasesSection";
import { useRecentReleases } from "@/hooks/discover";
import type { RecentReleaseAlbum } from "@/lib/types/search";

const mockHook = useRecentReleases as jest.Mock;

const album = (
  overrides: Partial<RecentReleaseAlbum> & { id: string },
): RecentReleaseAlbum => ({
  mbid: `mbid-${overrides.id}`,
  albumName: `Album ${overrides.id}`,
  artistName: "Artist",
  releaseDate: "2026-04-01",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RecentReleasesSection", () => {
  it("shows skeleton while loading", async () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true });
    const { queryByTestId } = await render(
      <RecentReleasesSection onAlbumPress={jest.fn()} />,
    );
    expect(queryByTestId("skeleton")).toBeTruthy();
  });

  it("returns null when data is empty", async () => {
    mockHook.mockReturnValue({ data: [], isLoading: false });
    const { toJSON } = await render(
      <RecentReleasesSection onAlbumPress={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders albums and fires onAlbumPress", async () => {
    const albums = [album({ id: "1" }), album({ id: "2" })];
    mockHook.mockReturnValue({ data: albums, isLoading: false });
    const onPress = jest.fn();

    const { getByText } = await render(
      <RecentReleasesSection onAlbumPress={onPress} />,
    );

    expect(getByText("Recent & Upcoming Releases")).toBeTruthy();
    await fireEvent.press(getByText("Album 1"));
    expect(onPress).toHaveBeenCalledWith(albums[0]);
  });
});
