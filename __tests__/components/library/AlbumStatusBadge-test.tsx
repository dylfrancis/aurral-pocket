jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { render } from "@testing-library/react-native";
import { AlbumStatusBadge } from "@/components/library/AlbumStatusBadge";
import type { Album } from "@/lib/types/library";

const baseAlbum: Album = {
  id: "1",
  artistId: "1",
  artistName: "Test Artist",
  mbid: "abc-123",
  albumName: "Test Album",
  title: "Test Album",
  releaseDate: "2024-01-01",
  monitored: false,
  statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AlbumStatusBadge", () => {
  it('shows "Complete" for a complete album', async () => {
    const { getByText } = await render(
      <AlbumStatusBadge album={baseAlbum} complete />,
    );
    expect(getByText("Complete")).toBeTruthy();
  });

  it('shows "Monitored" when monitored but not complete', async () => {
    const album = { ...baseAlbum, monitored: true };
    const { getByText } = await render(
      <AlbumStatusBadge album={album} complete={false} />,
    );
    expect(getByText("Monitored")).toBeTruthy();
  });

  it('shows "Unmonitored" when not monitored and not complete', async () => {
    const { getByText } = await render(
      <AlbumStatusBadge album={baseAlbum} complete={false} />,
    );
    expect(getByText("Unmonitored")).toBeTruthy();
  });
});
