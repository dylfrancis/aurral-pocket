const mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  ...require("@/test-support/expo-router-stack"),
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  getCanonicalLibraryPage: jest.fn(),
}));
jest.mock("@/lib/player/player", () => ({
  playQueueFrom: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ serverUrl: "https://music.example", token: "token" }),
}));
jest.mock("@/components/flow/AddToPlaylistSheet", () => ({
  AddToPlaylistSheet: () => null,
  useAddToPlaylist: () => ({ canAddToPlaylist: false, open: jest.fn() }),
}));
let mockSavedTrackIds = new Set<string>();
jest.mock("@/lib/offline/saved-library", () => ({
  ...jest.requireActual("@/lib/offline/saved-library"),
  useSavedTrackIds: () => mockSavedTrackIds,
}));
jest.mock("@shopify/flash-list", () => {
  const { FlatList } = require("react-native");
  return { FlashList: FlatList };
});
jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import ArtistSongsScreen from "@/app/(app)/(tabs)/(library)/artist/songs";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { playQueueFrom } from "@/lib/player/player";
import type { Album, CanonicalPage, Track } from "@/lib/types/library";

const mockGetCanonicalLibraryPage = getCanonicalLibraryPage as jest.Mock;
const mockPlayQueueFrom = playQueueFrom as jest.Mock;

function album(id: string, title: string, releaseDate: string): Album {
  return {
    id,
    artistId: "5",
    artistName: "Truth Club",
    mbid: `rg-${id}`,
    albumName: title,
    title,
    releaseDate,
    monitored: false,
    statistics: { trackCount: 2, sizeOnDisk: 0, percentOfTracks: 100 },
  };
}

function song(id: string, title: string, albumId: string, number: number) {
  return {
    id,
    mbid: "",
    trackName: title,
    title,
    trackNumber: number,
    hasFile: true,
    size: 1,
    quality: "FLAC",
    streamPath: `/library/stream/${albumId}/${id}`,
    available: true,
  } satisfies Track;
}

// The server's title order.
const TRACKS = [
  song("21", "77X", "2", 2),
  song("11", "Dry Off", "1", 1),
  song("22", "Suffer Debt", "2", 1),
  song("12", "Not An Exit", "1", 2),
];

function page(tracks: Track[]): CanonicalPage {
  return {
    kind: "tracks",
    page: 1,
    pageSize: 100,
    total: tracks.length,
    hasMore: false,
    artists: [],
    albums: [
      album("1", "Not an Exit", "2021-01-01"),
      album("2", "Running From the Chase", "2024-01-01"),
    ],
    tracks,
  };
}

const TITLES = new RegExp(
  `^(${TRACKS.map((track) => track.trackName).join("|")})$`,
);
const titles = () =>
  screen.queryAllByText(TITLES).map((title) => title.props.children);

async function openSongs(params: Record<string, string>) {
  Object.keys(mockParams).forEach((key) => delete mockParams[key]);
  Object.assign(mockParams, { artistId: "5", ...params });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await render(
    <QueryClientProvider client={client}>
      <ArtistSongsScreen />
    </QueryClientProvider>,
  );
  await screen.findByText("Dry Off");
}

beforeEach(() => {
  setBaseUrl("https://music.example");
  setAuthToken("session-token");
  mockGetCanonicalLibraryPage.mockReset();
  mockGetCanonicalLibraryPage.mockResolvedValue(page(TRACKS));
  mockPlayQueueFrom.mockClear();
});

describe("an artist's Songs page", () => {
  it("opens in album order, and plays from the tapped song in that order", async () => {
    await openSongs({ order: "album", show: "all" });

    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "tracks",
        artistId: "5",
        availableOnly: true,
        sort: "name",
      }),
    );
    expect(titles()).toEqual(["Dry Off", "Not An Exit", "Suffer Debt", "77X"]);

    await fireEvent.press(screen.getByText("Suffer Debt"));
    const [items, startId] = mockPlayQueueFrom.mock.calls[0];
    expect(items.map((item: { id: string }) => item.id)).toEqual([
      "11",
      "12",
      "22",
      "21",
    ]);
    expect(startId).toBe("22");
  });

  it("opens on the sort and filter its Show All asked for", async () => {
    await openSongs({ order: "favorited", show: "favorites" });

    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: "5",
        sort: "favorited",
        favorite: true,
      }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Favorites" }).props
        .accessibilityState.checked,
    ).toBe(true);
    expect(
      screen.getByRole("menuitem", { name: "Recently Favorited" }).props
        .accessibilityState.checked,
    ).toBe(true);
  });

  it("asks the server for a new sort, and offers no artist sort", async () => {
    await openSongs({ order: "album", show: "all" });

    expect(screen.queryByRole("menuitem", { name: "Artist A-Z" })).toBeNull();
    await fireEvent.press(
      screen.getByRole("menuitem", { name: "Most Played" }),
    );

    expect(mockGetCanonicalLibraryPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ artistId: "5", sort: "plays" }),
    );
  });

  it("lists only the songs saved offline, from the whole list", async () => {
    mockSavedTrackIds = new Set(["11", "21"]);
    await openSongs({ order: "plays", show: "saved" });

    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledWith(
      expect.objectContaining({ artistId: "5", sort: "plays" }),
    );
    expect(mockGetCanonicalLibraryPage).not.toHaveBeenCalledWith(
      expect.objectContaining({ favorite: true }),
    );
    expect(titles()).toEqual(["77X", "Dry Off"]);
  });

  it("searches the songs by title or album", async () => {
    await openSongs({ order: "album", show: "all" });

    await fireEvent.changeText(screen.getByLabelText("Search songs"), "chase");

    expect(titles()).toEqual(["Suffer Debt", "77X"]);
  });
});
