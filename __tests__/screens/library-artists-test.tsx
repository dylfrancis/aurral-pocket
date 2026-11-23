jest.mock("expo-router", () => ({
  ...require("@/test-support/expo-router-stack"),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("expo-router/react-navigation", () => ({
  useHeaderHeight: () => 0,
}));
jest.mock("@/lib/api/library", () => ({
  getCanonicalLibraryPage: jest.fn(),
}));
jest.mock("@/hooks/library/use-library-view", () =>
  require("@/test-support/library-view"),
);
jest.mock("@shopify/flash-list", () => {
  const { FlatList } = require("react-native");
  return { FlashList: FlatList };
});
jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));
jest.mock("@/components/library/AlphabetIndex", () => ({
  AlphabetIndex: () => null,
}));

import React, { Suspense } from "react";
import { Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import LibraryArtistsScreen from "@/app/(app)/(tabs)/(library)/artists";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import type { Artist, CanonicalPage } from "@/lib/types/library";

const mockGetCanonicalLibraryPage = getCanonicalLibraryPage as jest.Mock;

const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];

function artist(name: string): Artist {
  return {
    id: name.toLowerCase(),
    mbid: `mb-${name}`,
    artistName: name,
    monitored: false,
    addedAt: null,
    statistics: { albumCount: 1, trackCount: 1, sizeOnDisk: 0 },
  };
}

function page(names: string[]): CanonicalPage {
  return {
    kind: "artists",
    page: 1,
    pageSize: 100,
    total: names.length,
    hasMore: false,
    artists: names.map(artist),
    albums: [],
    tracks: [],
  };
}

async function openArtists() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<Text>Loading</Text>}>
        <LibraryArtistsScreen />
      </Suspense>
    </QueryClientProvider>,
  );
  await screen.findByText("Alpha");
}

async function pick(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });
}

const shownNames = () =>
  screen
    .getAllByText(new RegExp(`^(${NAMES.join("|")})$`))
    .map((node) => node.props.children);

beforeEach(() => {
  mockGetCanonicalLibraryPage.mockReset();
  mockGetCanonicalLibraryPage.mockResolvedValue(page(NAMES));
});

describe("Library › Artists", () => {
  it("keeps the server's order for Most Played, which only it knows", async () => {
    await openArtists();
    mockGetCanonicalLibraryPage.mockResolvedValue(page(["Echo", "Alpha"]));

    await pick("Most Played");

    await screen.findByText("Echo");
    expect(shownNames()).toEqual(["Echo", "Alpha"]);
    expect(mockGetCanonicalLibraryPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "artists", sort: "plays" }),
    );
  });

  it("keeps a Random order through a search, without asking the server again", async () => {
    await openArtists();

    await pick("Random");
    const shuffled = shownNames();
    expect([...shuffled].sort()).toEqual(NAMES);

    await fireEvent.changeText(screen.getByLabelText("Search artists..."), "o");

    expect(shownNames()).toEqual(
      shuffled.filter((name) => name.toLowerCase().includes("o")),
    );
    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledTimes(1);
  });

  it("asks for favorites with a status, and marks the filter on", async () => {
    await openArtists();
    expect(screen.queryByLabelText("Recently Favorited")).toBeNull();
    mockGetCanonicalLibraryPage.mockResolvedValue(page([]));

    await pick("Favorites");
    await pick("Missing Tracks");
    await pick("Recently Favorited");

    expect(mockGetCanonicalLibraryPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sort: "favorited",
        status: "missing",
        favorite: true,
      }),
    );
    expect(await screen.findByText("No artists to show")).toBeTruthy();
    expect(screen.getByLabelText("Filter, on")).toBeTruthy();
  });
});
