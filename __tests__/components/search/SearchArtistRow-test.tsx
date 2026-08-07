jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/lib/api/client", () => ({
  absolutizeImageUrl: (raw: string | null | undefined) => raw ?? null,
}));

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: any) => <View testID="expo-image" {...props} /> };
});

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SearchArtistRow } from "@/components/search/SearchArtistRow";
import type { SearchArtist } from "@/lib/types/search";

const baseArtist: SearchArtist = {
  id: "mbid-123",
  name: "Radiohead",
  sortName: "Radiohead",
  inLibrary: false,
  score: 0,
};

describe("SearchArtistRow", () => {
  it("renders artist name", async () => {
    const { getByText } = await render(
      <SearchArtistRow
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(getByText("Radiohead")).toBeTruthy();
  });

  it("does not render the sort-name as subtext", async () => {
    const artist = {
      ...baseArtist,
      name: "The Beatles",
      "sort-name": "Beatles, The",
    };
    const { queryByText } = await render(
      <SearchArtistRow
        artist={artist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(queryByText("Beatles, The")).toBeNull();
  });

  it('shows "In Library" chip when isInLibrary is true', async () => {
    const { getByText } = await render(
      <SearchArtistRow
        artist={baseArtist}
        isInLibrary={true}
        onPress={() => {}}
      />,
    );
    expect(getByText("In Library")).toBeTruthy();
  });

  it('does not show "In Library" chip when isInLibrary is false', async () => {
    const { queryByText } = await render(
      <SearchArtistRow
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(queryByText("In Library")).toBeNull();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <SearchArtistRow
        artist={baseArtist}
        isInLibrary={false}
        onPress={onPress}
      />,
    );
    await fireEvent.press(getByText("Radiohead"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("always renders the placeholder, never an image", async () => {
    // /search/unified returns no artwork, and resolving covers per row would
    // cost one request per visible result.
    const { queryByTestId, getByTestId } = await render(
      <SearchArtistRow
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(queryByTestId("expo-image")).toBeNull();
    expect(getByTestId("icon-person-outline")).toBeTruthy();
  });
});
