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
    withRepeat: jest.fn(),
    withTiming: jest.fn(),
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
import { Text } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { ArtistHero } from "@/components/library/ArtistHero";
import type { Artist } from "@/lib/types/library";

const baseArtist: Artist = {
  id: "1",
  mbid: "abc-123",
  foreignArtistId: "abc-123",
  artistName: "Test Artist",
  monitored: true,
  addedAt: "2024-01-01",
  statistics: { albumCount: 5, trackCount: 50, sizeOnDisk: 1000 },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ArtistHero", () => {
  it("renders artist name", async () => {
    const { getByText } = await render(
      <ArtistHero artist={baseArtist} inLibrary={false} />,
    );
    expect(getByText("Test Artist")).toBeTruthy();
  });

  it("shows the artist's listeners under the name, and nothing without a count", async () => {
    const { getByText, queryByText, rerender } = await render(
      <ArtistHero
        artist={baseArtist}
        listeners={8_412_000}
        inLibrary={false}
      />,
    );
    expect(getByText("8.4M listeners")).toBeTruthy();

    await rerender(
      <ArtistHero artist={baseArtist} listeners={null} inLibrary={false} />,
    );
    expect(queryByText(/listeners?$/)).toBeNull();
  });

  it("shows a library artist's capsule, then Play, Shuffle and the heart", async () => {
    const { getByText, getByLabelText } = await render(
      <ArtistHero
        artist={baseArtist}
        inLibrary
        libraryControl={<Text>In Library · Monitored</Text>}
        play={{ disabled: false, onPlay: jest.fn(), onShuffle: jest.fn() }}
        favorite={{ active: false, onToggle: jest.fn() }}
      />,
    );
    expect(getByText("In Library · Monitored")).toBeTruthy();
    expect(getByText("Play")).toBeTruthy();
    expect(getByLabelText("Shuffle Test Artist")).toBeTruthy();
    expect(getByLabelText("Add Test Artist to favorites")).toBeTruthy();
  });

  it("offers no favorite for an artist outside the library", async () => {
    const { queryByLabelText } = await render(
      <ArtistHero
        artist={baseArtist}
        inLibrary={false}
        favorite={{ active: false, onToggle: jest.fn() }}
      />,
    );
    expect(queryByLabelText(/to favorites$/)).toBeNull();
  });

  it("plays and shuffles a library artist", async () => {
    const onPlay = jest.fn();
    const onShuffle = jest.fn();
    const { getByText, getByLabelText } = await render(
      <ArtistHero
        artist={baseArtist}
        inLibrary
        play={{ disabled: false, onPlay, onShuffle }}
      />,
    );
    await fireEvent.press(getByText("Play"));
    await fireEvent.press(getByLabelText("Shuffle Test Artist"));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onShuffle).toHaveBeenCalledTimes(1);
  });

  it("renders add button when not in library", async () => {
    const onAdd = jest.fn();
    const { getByText } = await render(
      <ArtistHero artist={baseArtist} inLibrary={false} onAddPress={onAdd} />,
    );
    expect(getByText("Add to Library")).toBeTruthy();
  });

  it("offers no Play row or add button outside the library without callbacks", async () => {
    const { queryByText } = await render(
      <ArtistHero
        artist={baseArtist}
        inLibrary={false}
        play={{ disabled: false, onPlay: jest.fn(), onShuffle: jest.fn() }}
      />,
    );
    expect(queryByText("Play")).toBeNull();
    expect(queryByText("Add to Library")).toBeNull();
  });

  it("renders with minimal artist props (mbid + artistName only)", async () => {
    const { getByText } = await render(
      <ArtistHero
        artist={{ mbid: "xyz-456", artistName: "Minimal Artist" }}
        inLibrary={false}
      />,
    );
    expect(getByText("Minimal Artist")).toBeTruthy();
  });
});
