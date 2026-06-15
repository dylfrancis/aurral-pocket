jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/components/library/CoverArtImage", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    CoverArtImage: () => React.createElement(View, { testID: "cover-art" }),
  };
});

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SearchAlbumRow } from "@/components/search/SearchAlbumRow";
import type { SearchAlbum } from "@/lib/types/search";

const baseAlbum: SearchAlbum = {
  type: "album",
  id: "release-group-1",
  title: "Abbey Road",
  artistName: "The Beatles",
  artistMbid: "artist-mbid",
  releaseDate: "1969-09-26",
  primaryType: "Album",
  secondaryTypes: [],
  coverUrl: null,
  inLibrary: false,
  libraryAlbumId: null,
  libraryArtistId: null,
  status: "missing",
};

describe("SearchAlbumRow", () => {
  it("renders title, artist and meta line", async () => {
    const { getByText } = await render(
      <SearchAlbumRow album={baseAlbum} onPress={() => {}} />,
    );
    expect(getByText("Abbey Road")).toBeTruthy();
    expect(getByText("The Beatles")).toBeTruthy();
    expect(getByText("1969 · Album")).toBeTruthy();
  });

  it("appends secondary types to the meta line", async () => {
    const { getByText } = await render(
      <SearchAlbumRow
        album={{ ...baseAlbum, secondaryTypes: ["Live", "Soundtrack"] }}
        onPress={() => {}}
      />,
    );
    expect(getByText("1969 · Album · Live · Soundtrack")).toBeTruthy();
  });

  it("renders the available status pill when status is available", async () => {
    const { getByText } = await render(
      <SearchAlbumRow
        album={{ ...baseAlbum, status: "available" }}
        onPress={() => {}}
      />,
    );
    expect(getByText("Available")).toBeTruthy();
  });

  it("renders the inLibrary status pill when status is inLibrary", async () => {
    const { getByText } = await render(
      <SearchAlbumRow
        album={{ ...baseAlbum, status: "inLibrary" }}
        onPress={() => {}}
      />,
    );
    expect(getByText("In Library")).toBeTruthy();
  });

  it("hides the status pill when status is missing", async () => {
    const { queryByText } = await render(
      <SearchAlbumRow album={baseAlbum} onPress={() => {}} />,
    );
    expect(queryByText("Missing")).toBeNull();
    expect(queryByText("Available")).toBeNull();
    expect(queryByText("In Library")).toBeNull();
  });

  it("calls onPress when tapped", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <SearchAlbumRow album={baseAlbum} onPress={onPress} />,
    );
    await fireEvent.press(getByText("Abbey Road"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
