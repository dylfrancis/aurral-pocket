jest.mock("expo-router", () => ({
  ...require("@/test-support/expo-router-stack"),
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
jest.mock("@/hooks/library/use-library-view", () =>
  require("@/test-support/library-view"),
);
jest.mock("@/components/flow/AddToPlaylistSheet", () => ({
  AddToPlaylistSheet: () => null,
  useAddToPlaylist: () => ({ canAddToPlaylist: false, open: jest.fn() }),
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
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import LibrarySongsScreen from "@/app/(app)/(tabs)/(library)/songs";
import { LIBRARY_SONGS } from "@/hooks/library/use-play-songs";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { playQueueFrom } from "@/lib/player/player";
import type { Album, Artist, CanonicalPage, Track } from "@/lib/types/library";

const mockGetCanonicalLibraryPage = getCanonicalLibraryPage as jest.Mock;
const mockPlayQueueFrom = playQueueFrom as jest.Mock;

function album(id: string, title: string, artistId: string): Album {
  return {
    id,
    artistId,
    // The album's own credit; the page's artist row names it better.
    artistName: "",
    mbid: `rg-${id}`,
    foreignAlbumId: `rg-${id}`,
    albumName: title,
    title,
    releaseDate: null,
    monitored: false,
    statistics: { trackCount: 1, sizeOnDisk: 0, percentOfTracks: 100 },
    coverUrl: `/api/library/albums/${id}/cover`,
  };
}

function artist(id: string, artistName: string): Artist {
  return {
    id,
    mbid: `mb-${id}`,
    foreignArtistId: `mb-${id}`,
    artistName,
    monitored: false,
    addedAt: null,
    statistics: { albumCount: 1, trackCount: 1, sizeOnDisk: 0 },
  };
}

function song(id: string, title: string, albumId: string): Track {
  return {
    id,
    mbid: "",
    trackName: title,
    title,
    trackNumber: 1,
    hasFile: true,
    size: 1,
    quality: "FLAC",
    streamPath: `/library/stream/${albumId}/${id}`,
    streamFormat: "flac",
    available: true,
    artistName: "",
  };
}

const PAGE: CanonicalPage = {
  kind: "tracks",
  page: 1,
  pageSize: 100,
  total: 3,
  hasMore: false,
  artists: [artist("3", "Radiohead"), artist("9", "Local Band")],
  albums: [album("4", "Kid A", "3"), album("13", "Garage Tape", "9")],
  tracks: [
    song("3", "Everything in Its Right Place", "4"),
    song("4", "Kid A", "4"),
    song("6", "Song One", "13"),
  ],
};

async function openSongs() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await render(
    <QueryClientProvider client={client}>
      <LibrarySongsScreen />
    </QueryClientProvider>,
  );
  await screen.findByText("Song One");
}

beforeEach(() => {
  setBaseUrl("https://music.example");
  setAuthToken("session-token");
  mockGetCanonicalLibraryPage.mockReset();
  mockGetCanonicalLibraryPage.mockResolvedValue(PAGE);
  mockPlayQueueFrom.mockClear();
});

describe("Library › Songs", () => {
  it("lists the playable songs, each with its album's artist and title", async () => {
    await openSongs();

    expect(screen.getAllByText("Radiohead · Kid A")).toHaveLength(2);
    expect(screen.getByText("Local Band · Garage Tape")).toBeTruthy();
    expect(mockGetCanonicalLibraryPage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "tracks", availableOnly: true }),
    );
  });

  it("plays the loaded songs from the tapped one, each under its own album", async () => {
    await openSongs();

    await act(async () => {
      fireEvent.press(screen.getByText("Song One"));
    });

    expect(mockPlayQueueFrom).toHaveBeenCalledTimes(1);
    const [items, startId, context] = mockPlayQueueFrom.mock.calls[0];
    expect(
      items.map(({ id, album, artist }: Record<string, string>) => ({
        id,
        album,
        artist,
      })),
    ).toEqual([
      { id: "3", album: "Kid A", artist: "Radiohead" },
      { id: "4", album: "Kid A", artist: "Radiohead" },
      { id: "6", album: "Garage Tape", artist: "Local Band" },
    ]);
    expect(startId).toBe("6");
    expect(context).toBe(LIBRARY_SONGS);
  });
});
