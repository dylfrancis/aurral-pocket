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
  foreignAlbumId: "abc-123",
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
  it('shows "Complete" when percentOfTracks >= 100', () => {
    const album = {
      ...baseAlbum,
      statistics: { trackCount: 10, sizeOnDisk: 500, percentOfTracks: 100 },
    };
    const { getByText } = render(<AlbumStatusBadge album={album} />);
    expect(getByText("Complete")).toBeTruthy();
  });

  it('shows "Complete" when sizeOnDisk > 0', () => {
    const album = {
      ...baseAlbum,
      statistics: { trackCount: 10, sizeOnDisk: 100, percentOfTracks: 50 },
    };
    const { getByText } = render(<AlbumStatusBadge album={album} />);
    expect(getByText("Complete")).toBeTruthy();
  });

  it('shows "Monitored" when monitored but not complete', () => {
    const album = { ...baseAlbum, monitored: true };
    const { getByText } = render(<AlbumStatusBadge album={album} />);
    expect(getByText("Monitored")).toBeTruthy();
  });

  it('shows "Unmonitored" when not monitored and not complete', () => {
    const { getByText } = render(<AlbumStatusBadge album={baseAlbum} />);
    expect(getByText("Unmonitored")).toBeTruthy();
  });
});
