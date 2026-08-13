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
    withTiming: jest.fn(),
  };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { TopTracksSection } from "@/components/artist/TopTracksSection";
import type { PreviewTrack } from "@/lib/types/library";

const TRACKS: PreviewTrack[] = [
  {
    id: "t-1",
    title: "Weird Fishes",
    album: "In Rainbows",
    preview_url: "https://example.com/1.m4a",
    duration_ms: 240_000,
  },
  {
    id: "t-2",
    title: "Reckoner",
    album: "In Rainbows",
    preview_url: "https://example.com/2.m4a",
    duration_ms: 210_000,
  },
];

async function renderSection(onAddToPlaylist?: (track: PreviewTrack) => void) {
  const onToggle = jest.fn();
  const utils = await render(
    <TopTracksSection
      tracks={TRACKS}
      playingId={null}
      progress={0}
      onToggle={onToggle}
      onAddToPlaylist={onAddToPlaylist}
    />,
  );
  return { ...utils, onToggle };
}

describe("TopTracksSection", () => {
  it("calls onAddToPlaylist with the row's track when the + button is pressed", async () => {
    const onAddToPlaylist = jest.fn();
    const { getByLabelText } = await renderSection(onAddToPlaylist);
    await fireEvent.press(getByLabelText("Add Reckoner to a playlist"));
    expect(onAddToPlaylist).toHaveBeenCalledWith(TRACKS[1]);
  });

  it("shows no + button without an onAddToPlaylist handler", async () => {
    const { queryByLabelText } = await renderSection(undefined);
    expect(queryByLabelText("Add Reckoner to a playlist")).toBeNull();
  });

  it("still toggles preview playback on press", async () => {
    const { getByText, onToggle } = await renderSection(jest.fn());
    await fireEvent.press(getByText("Weird Fishes"));
    expect(onToggle).toHaveBeenCalledWith(TRACKS[0]);
  });
});
