const mockPush = jest.fn();

jest.mock("expo-router", () => {
  const React = require("react");
  const Passthrough = ({ children }: { children?: unknown }) =>
    React.createElement(React.Fragment, null, children);
  return {
    Stack: {
      Screen: () => null,
      Toolbar: Object.assign(Passthrough, {
        Menu: Passthrough,
        MenuAction: () => null,
      }),
    },
    useRouter: () => ({ push: mockPush }),
  };
});

jest.mock("@/lib/api/search", () => ({
  getReleaseFeed: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "dark",
}));

jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

jest.mock("@/components/artist/AlbumCategorySkeleton", () => ({
  AlbumCategorySkeleton: () => null,
}));

// The real pills are SwiftUI and Compose views.
jest.mock("@/components/ui/PillRow", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    PillRow: ({ items, selected, onSelect }: any) =>
      React.createElement(
        View,
        null,
        items.map((item: any) =>
          React.createElement(
            Pressable,
            {
              key: item.id,
              accessibilityRole: "tab",
              accessibilityState: { selected: item.id === selected },
              onPress: () => onSelect(item.id),
            },
            React.createElement(Text, null, item.label),
          ),
        ),
      ),
  };
});

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReleasesScreen from "@/app/(app)/(tabs)/(discover)/releases";
import { getReleaseFeed } from "@/lib/api/search";
import type { RecentReleaseAlbum } from "@/lib/types/search";

const mockGetReleaseFeed = getReleaseFeed as jest.Mock;

const release = (
  id: string,
  overrides: Partial<RecentReleaseAlbum> = {},
): RecentReleaseAlbum => ({
  id,
  releaseGroupMbid: id,
  albumName: `Album ${id}`,
  artistName: "Artist",
  artistMbid: "artist-mbid",
  releaseDate: "2026-11-19",
  coverUrl: null,
  albumType: "Album",
  secondaryTypes: [],
  ...overrides,
});

async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <QueryClientProvider client={client}>
      <ReleasesScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ReleasesScreen", () => {
  it("opens a release's page without a Library artist id", async () => {
    // A recommended artist's release carries the artist's MBID as artistId.
    mockGetReleaseFeed.mockResolvedValue({
      releases: [
        release("rg-1", {
          albumName: "Anything",
          artistId: "artist-mbid",
          secondaryTypes: ["Live"],
        }),
      ],
      hasMore: false,
    });
    await renderScreen();

    await fireEvent.press(await screen.findByText("Anything"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/release/[mbid]",
      params: {
        mbid: "rg-1",
        title: "Anything",
        artistName: "Artist",
        artistMbid: "artist-mbid",
        artistId: "",
        primaryType: "Album",
        secondaryTypes: "Live",
        releaseDate: "2026-11-19",
        status: "",
      },
    });
  });

  it("lists upcoming releases from the Upcoming pill", async () => {
    mockGetReleaseFeed.mockImplementation(async (when: string) => ({
      releases: [
        when === "upcoming"
          ? release("rg-next", { albumName: "Next One" })
          : release("rg-out", { albumName: "Out Now" }),
      ],
      hasMore: false,
    }));
    await renderScreen();
    expect(await screen.findByText("Out Now")).toBeTruthy();

    await fireEvent.press(screen.getByRole("tab", { name: "Upcoming" }));

    expect(await screen.findByText("Next One")).toBeTruthy();
    expect(screen.queryByText("Out Now")).toBeNull();
    expect(mockGetReleaseFeed).toHaveBeenLastCalledWith("upcoming", 0, 24);
  });

  it("loads the next page at the end, skipping a release it already shows", async () => {
    mockGetReleaseFeed
      .mockResolvedValueOnce({
        releases: [release("rg-1"), release("rg-2")],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        // A metadata refresh between reads shifted rg-2 onto this page.
        releases: [release("rg-2"), release("rg-3")],
        hasMore: false,
      });
    await renderScreen();

    await fireEvent(await screen.findByText("Album rg-1"), "endReached");

    expect(await screen.findByText("Album rg-3")).toBeTruthy();
    expect(mockGetReleaseFeed).toHaveBeenLastCalledWith("released", 2, 24);
    expect(screen.getAllByText("Album rg-2")).toHaveLength(1);

    // The last page said there are no more.
    await fireEvent(screen.getByText("Album rg-1"), "endReached");

    expect(mockGetReleaseFeed).toHaveBeenCalledTimes(2);
  });
});
