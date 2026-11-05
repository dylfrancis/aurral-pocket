jest.mock("@/lib/api/library", () => ({
  getAlbumCover: jest.fn(),
  getArtistCover: jest.fn(),
}));

jest.mock("@/components/ui/Skeleton", () => ({
  Skeleton: () => null,
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
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { getAlbumCover } from "@/lib/api/library";
import { setBaseUrl } from "@/lib/api/client";

const mockGetAlbumCover = getAlbumCover as jest.Mock;

async function renderCover(props: { mbid: string; coverUrl?: string }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <QueryClientProvider client={client}>
      <CoverArtImage type="album" size={150} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setBaseUrl("https://music.example");
});

describe("CoverArtImage", () => {
  it("loads a server cover path without looking the cover up by MBID", async () => {
    await renderCover({
      mbid: "rg-1",
      coverUrl: "/api/library/albums/12/cover?v=abc",
    });

    expect(screen.getByTestId("cover-image").props.accessibilityLabel).toBe(
      "https://music.example/api/library/albums/12/cover?v=abc",
    );
    expect(mockGetAlbumCover).not.toHaveBeenCalled();
  });

  it("falls back to the MBID lookup when the server has no artwork, then to the placeholder", async () => {
    mockGetAlbumCover.mockResolvedValue({
      images: [{ image: "https://covers.example/rg-1.jpg", front: true }],
    });
    await renderCover({
      mbid: "rg-1",
      coverUrl: "/api/library/albums/12/cover",
    });

    // The server answers 404 for an album it has no artwork for.
    await fireEvent(screen.getByTestId("cover-image"), "error");

    expect(mockGetAlbumCover).toHaveBeenCalledWith("rg-1");
    await waitFor(() =>
      expect(screen.getByTestId("cover-image").props.accessibilityLabel).toBe(
        "https://covers.example/rg-1.jpg",
      ),
    );

    await fireEvent(screen.getByTestId("cover-image"), "error");

    expect(screen.queryByTestId("cover-image")).toBeNull();
  });
});
