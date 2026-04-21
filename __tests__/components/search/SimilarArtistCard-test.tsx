jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockAnimatedView = React.forwardRef(function MockAnimatedView(
    props: any,
    ref: any,
  ) {
    return React.createElement(View, { ...props, ref });
  });
  return {
    __esModule: true,
    default: { View: MockAnimatedView, ScrollView: MockAnimatedView },
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (val: number) => ({ value: val }),
    withRepeat: jest.fn(),
    withSequence: jest.fn(),
    withTiming: jest.fn(),
    interpolate: () => 0,
    Easing: { inOut: jest.fn(), quad: {} },
  };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/hooks/library/use-cover-art-url", () => ({
  useCoverArtUrl: jest.fn(() => ({
    url: "https://example.com/art.jpg",
    isLoading: false,
  })),
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SimilarArtistCard } from "@/components/search/SimilarArtistCard";
import type { SimilarArtist } from "@/lib/types/search";

const baseArtist: SimilarArtist = {
  id: "mbid-456",
  name: "Thom Yorke",
  image: "https://img.com/thom.jpg",
  match: 92,
};

describe("SimilarArtistCard", () => {
  it("renders artist name", () => {
    const { getByText } = render(
      <SimilarArtistCard
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(getByText("Thom Yorke")).toBeTruthy();
  });

  it("renders match percentage", () => {
    const { getByText } = render(
      <SimilarArtistCard
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(getByText("92% match")).toBeTruthy();
  });

  it('shows "In Library" chip when isInLibrary is true', () => {
    const { getByText } = render(
      <SimilarArtistCard
        artist={baseArtist}
        isInLibrary={true}
        onPress={() => {}}
      />,
    );
    expect(getByText("In Library")).toBeTruthy();
  });

  it('does not show "In Library" chip when isInLibrary is false', () => {
    const { queryByText } = render(
      <SimilarArtistCard
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
      <SimilarArtistCard
        artist={baseArtist}
        isInLibrary={false}
        onPress={onPress}
      />,
    );
    fireEvent.press(getByText("Thom Yorke"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not render match percentage when match is 0", () => {
    const artist = { ...baseArtist, match: 0 };
    const { queryByText } = render(
      <SimilarArtistCard
        artist={artist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(queryByText("0% match")).toBeNull();
  });
});
