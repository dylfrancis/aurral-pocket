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

import { render, fireEvent } from "@testing-library/react-native";
import { HorizontalArtistCard } from "@/components/discover/HorizontalArtistCard";

describe("HorizontalArtistCard", () => {
  it("renders the artist name and cover art", () => {
    const { getByText, queryByTestId } = render(
      <HorizontalArtistCard
        mbid="mbid-1"
        name="Radiohead"
        onPress={jest.fn()}
      />,
    );
    expect(getByText("Radiohead")).toBeTruthy();
    expect(queryByTestId("cover-art")).toBeTruthy();
  });

  it("renders the subtitle when provided", () => {
    const { queryByText } = render(
      <HorizontalArtistCard
        mbid="mbid-1"
        name="Radiohead"
        subtitle="Similar to Portishead"
        onPress={jest.fn()}
      />,
    );
    expect(queryByText("Similar to Portishead")).toBeTruthy();
  });

  it("renders the library badge when isInLibrary is true", () => {
    const { queryByTestId } = render(
      <HorizontalArtistCard
        mbid="mbid-1"
        name="Radiohead"
        isInLibrary
        onPress={jest.fn()}
      />,
    );
    expect(queryByTestId("icon-checkmark-circle")).toBeTruthy();
  });

  it("omits the library badge when isInLibrary is false", () => {
    const { queryByTestId } = render(
      <HorizontalArtistCard
        mbid="mbid-1"
        name="Radiohead"
        onPress={jest.fn()}
      />,
    );
    expect(queryByTestId("icon-checkmark-circle")).toBeNull();
  });

  it("fires onPress when the card is pressed", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <HorizontalArtistCard mbid="mbid-1" name="Radiohead" onPress={onPress} />,
    );
    fireEvent.press(getByText("Radiohead"));
    expect(onPress).toHaveBeenCalled();
  });
});
