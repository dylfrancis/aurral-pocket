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
  "sort-name": "Radiohead",
  image: "https://img.com/radiohead.jpg",
  imageUrl: "https://img.com/radiohead.jpg",
  listeners: null,
};

describe("SearchArtistRow", () => {
  it("renders artist name", () => {
    const { getByText } = render(
      <SearchArtistRow
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(getByText("Radiohead")).toBeTruthy();
  });

  it("does not render the sort-name as subtext", () => {
    const artist = {
      ...baseArtist,
      name: "The Beatles",
      "sort-name": "Beatles, The",
    };
    const { queryByText } = render(
      <SearchArtistRow
        artist={artist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(queryByText("Beatles, The")).toBeNull();
  });

  it('shows "In Library" chip when isInLibrary is true', () => {
    const { getByText } = render(
      <SearchArtistRow
        artist={baseArtist}
        isInLibrary={true}
        onPress={() => {}}
      />,
    );
    expect(getByText("In Library")).toBeTruthy();
  });

  it('does not show "In Library" chip when isInLibrary is false', () => {
    const { queryByText } = render(
      <SearchArtistRow
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(queryByText("In Library")).toBeNull();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <SearchArtistRow
        artist={baseArtist}
        isInLibrary={false}
        onPress={onPress}
      />,
    );
    fireEvent.press(getByText("Radiohead"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders image when available", () => {
    const { getByTestId } = render(
      <SearchArtistRow
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(getByTestId("expo-image")).toBeTruthy();
  });

  it("renders placeholder when no image", () => {
    const artist = { ...baseArtist, image: null, imageUrl: null };
    const { queryByTestId } = render(
      <SearchArtistRow
        artist={artist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(queryByTestId("expo-image")).toBeNull();
  });
});
