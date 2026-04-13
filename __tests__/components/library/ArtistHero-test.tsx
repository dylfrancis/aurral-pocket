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
    useAnimatedScrollHandler: () => () => {},
    interpolate: (val: number, input: number[], output: number[]) => {
      const [inMin, inMax] = input;
      const [outMin, outMax] = output;
      const clamped = Math.min(Math.max(val, inMin), inMax);
      const ratio = (clamped - inMin) / (inMax - inMin);
      return outMin + ratio * (outMax - outMin);
    },
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

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: function MockLinearGradient(props: any) {
      return React.createElement(View, { ...props, testID: "linear-gradient" });
    },
  };
});

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ArtistHero } from "@/components/library/ArtistHero";
import type { Artist } from "@/lib/types/library";

const baseArtist: Artist = {
  id: "1",
  mbid: "abc-123",
  foreignArtistId: "abc-123",
  artistName: "Test Artist",
  monitored: true,
  monitorOption: "all",
  addedAt: "2024-01-01",
  statistics: { albumCount: 5, trackCount: 50, sizeOnDisk: 1000 },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ArtistHero", () => {
  it("renders artist name", () => {
    const { getByText } = render(
      <ArtistHero artist={baseArtist} inLibrary={false} />,
    );
    expect(getByText("Test Artist")).toBeTruthy();
  });

  it("renders library badge when inLibrary", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ArtistHero artist={baseArtist} inLibrary onBadgePress={onPress} />,
    );
    expect(getByText("In Your Library")).toBeTruthy();
  });

  it("calls onBadgePress when badge is tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ArtistHero artist={baseArtist} inLibrary onBadgePress={onPress} />,
    );
    fireEvent.press(getByText("In Your Library"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders add button when not in library", () => {
    const onAdd = jest.fn();
    const { getByText } = render(
      <ArtistHero artist={baseArtist} inLibrary={false} onAddPress={onAdd} />,
    );
    expect(getByText("Add to Library")).toBeTruthy();
  });

  it("does not render badge or add button without callbacks", () => {
    const { queryByText } = render(
      <ArtistHero artist={baseArtist} inLibrary={false} />,
    );
    expect(queryByText("In Your Library")).toBeNull();
    expect(queryByText("Add to Library")).toBeNull();
  });

  it("renders with minimal artist props (mbid + artistName only)", () => {
    const { getByText } = render(
      <ArtistHero
        artist={{ mbid: "xyz-456", artistName: "Minimal Artist" }}
        inLibrary={false}
      />,
    );
    expect(getByText("Minimal Artist")).toBeTruthy();
  });
});
