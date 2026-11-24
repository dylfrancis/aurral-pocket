jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

jest.mock("@/components/offline/SavedMark", () => ({
  SavedMark: () => null,
  albumSavedId: () => "album:14",
}));

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { AlbumCard } from "@/components/library/AlbumCard";
import { Colors } from "@/constants/theme";
import type { Album } from "@/lib/types/library";

const album = (trackCount: number, trackFileCount: number): Album => ({
  id: "14",
  artistId: "7",
  artistName: "Radiohead",
  mbid: "rg-1",
  albumName: "OK Computer",
  title: "OK Computer",
  releaseDate: "1997-05-21",
  monitored: false,
  statistics: {
    trackCount,
    trackFileCount,
    sizeOnDisk: 0,
    percentOfTracks: Math.round((trackFileCount / trackCount) * 100),
  },
});

describe("AlbumCard", () => {
  it.each([
    { files: 11, label: "11/12 tracks", tinted: true },
    { files: 12, label: "12 tracks", tinted: false },
  ])(
    "tints the count only while songs are missing: $label",
    async ({ files, label, tinted }) => {
      await render(<AlbumCard album={album(12, files)} onPress={jest.fn()} />);

      const { color } = StyleSheet.flatten(screen.getByText(label).props.style);
      expect(color === Colors.dark.warning).toBe(tinted);
    },
  );
});
