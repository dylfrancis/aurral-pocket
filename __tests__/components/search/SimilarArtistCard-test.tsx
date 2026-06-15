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
  it("renders artist name", async () => {
    const { getByText } = await render(
      <SimilarArtistCard
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(getByText("Thom Yorke")).toBeTruthy();
  });

  it("renders match percentage", async () => {
    const { getByText } = await render(
      <SimilarArtistCard
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(getByText("92% match")).toBeTruthy();
  });

  it("renders the library badge when isInLibrary is true", async () => {
    const { queryByTestId } = await render(
      <SimilarArtistCard
        artist={baseArtist}
        isInLibrary={true}
        onPress={() => {}}
      />,
    );
    expect(queryByTestId("icon-checkmark-circle")).toBeTruthy();
  });

  it("omits the library badge when isInLibrary is false", async () => {
    const { queryByTestId } = await render(
      <SimilarArtistCard
        artist={baseArtist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(queryByTestId("icon-checkmark-circle")).toBeNull();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <SimilarArtistCard
        artist={baseArtist}
        isInLibrary={false}
        onPress={onPress}
      />,
    );
    await fireEvent.press(getByText("Thom Yorke"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not render match percentage when match is 0", async () => {
    const artist = { ...baseArtist, match: 0 };
    const { queryByText } = await render(
      <SimilarArtistCard
        artist={artist}
        isInLibrary={false}
        onPress={() => {}}
      />,
    );
    expect(queryByText("0% match")).toBeNull();
  });
});
