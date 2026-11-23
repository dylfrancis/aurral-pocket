jest.mock("@/lib/api/library", () => ({
  getAlbumCover: jest.fn(),
  getArtistCover: jest.fn(),
}));

jest.mock("@/components/ui/Skeleton", () => ({
  Skeleton: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "dark",
}));

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: { source?: { uri?: string }; onError?: () => void }) =>
      React.createElement(View, {
        testID: "cover-image",
        accessibilityLabel: props.source?.uri,
        onError: props.onError,
      }),
  };
});

import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DiscoverReleaseCard } from "@/components/discover/DiscoverReleaseCard";
import { setBaseUrl } from "@/lib/api/client";
import { getAlbumCover, getArtistCover } from "@/lib/api/library";
import type { RecentReleaseAlbum } from "@/lib/types/search";

const mockGetAlbumCover = getAlbumCover as jest.Mock;
const mockGetArtistCover = getArtistCover as jest.Mock;

const album: RecentReleaseAlbum = {
  id: "rg-1",
  mbid: "rg-1",
  albumName: "Anything",
  artistName: "Phoebe Bridgers",
  artistMbid: "artist-1",
  releaseDate: "2026-11-19",
  coverUrl: "/api/artists/release-group/rg-1/cover/image",
  albumType: "Album",
  secondaryTypes: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  setBaseUrl("https://music.example");
});

describe("DiscoverReleaseCard", () => {
  it("shows the server's cover, then the artist's photo when the album has none", async () => {
    mockGetAlbumCover.mockResolvedValue({ images: [] });
    mockGetArtistCover.mockResolvedValue({
      images: [{ image: "https://images.example/artist-1.jpg", front: true }],
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await render(
      <QueryClientProvider client={client}>
        <DiscoverReleaseCard album={album} onPress={jest.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("cover-image").props.accessibilityLabel).toBe(
      "https://music.example/api/artists/release-group/rg-1/cover/image",
    );

    // The server answers 404 when it has no cover for the release group.
    await fireEvent(screen.getByTestId("cover-image"), "error");

    // The names let the server search Deezer when metadata lookups fail.
    expect(mockGetAlbumCover).toHaveBeenCalledWith("rg-1", {
      artistName: "Phoebe Bridgers",
      albumTitle: "Anything",
    });
    await waitFor(() =>
      expect(screen.getByTestId("cover-image").props.accessibilityLabel).toBe(
        "https://images.example/artist-1.jpg",
      ),
    );
    expect(mockGetArtistCover).toHaveBeenCalledWith("artist-1");
  });
});
