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
    default: { View: MockAnimatedView },
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (val: number) => ({ value: val }),
    useReducedMotion: () => false,
    cancelAnimation: jest.fn(),
    withDelay: jest.fn(),
    withRepeat: jest.fn(),
    withTiming: jest.fn(),
  };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/lib/player/player", () => ({
  useCurrentTrack: jest.fn(() => null),
  usePlaybackState: jest.fn(() => "stopped"),
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { TrackRow } from "@/components/library/TrackRow";
import { useCurrentTrack, usePlaybackState } from "@/lib/player/player";
import type { Track } from "@/lib/types/library";

const mockCurrentTrack = useCurrentTrack as jest.Mock;
const mockPlaybackState = usePlaybackState as jest.Mock;

beforeEach(() => {
  mockCurrentTrack.mockReturnValue(null);
  mockPlaybackState.mockReturnValue("stopped");
});

const TRACK: Track = {
  id: "t-1",
  mbid: "mbid-1",
  trackName: "Weird Fishes",
  title: "Weird Fishes",
  trackNumber: 4,
  hasFile: true,
  size: 1024,
  quality: "FLAC",
};

describe("TrackRow", () => {
  it("calls onLongPress when the row is long-pressed", async () => {
    const onLongPress = jest.fn();
    const { getByText } = await render(
      <TrackRow track={TRACK} onLongPress={onLongPress} />,
    );
    await fireEvent(getByText("Weird Fishes"), "longPress");
    expect(onLongPress).toHaveBeenCalled();
  });

  it("renders the track name without a handler", async () => {
    const { getByText, queryByText } = await render(<TrackRow track={TRACK} />);
    expect(getByText("Weird Fishes")).toBeTruthy();
    // The number gave way to the playing indicator, which needs the space.
    expect(queryByText("4")).toBeNull();
  });

  it("plays a track that Aurral can stream", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <TrackRow
        track={{ ...TRACK, streamPath: "/library/canonical-stream/1/t-1" }}
        onPress={onPress}
      />,
    );

    await fireEvent.press(getByText("Weird Fishes"));

    expect(onPress).toHaveBeenCalled();
  });

  it("reports a tap on a track Aurral cannot stream, so the screen can explain why", async () => {
    // Lidarr owns the file but Aurral cannot read it, so streamPath is null.
    // Swallowing the tap here would make an unplayable track look identical
    // to a broken player. The screen decides what to say.
    const onPress = jest.fn();
    const { getByText } = await render(
      <TrackRow track={{ ...TRACK, streamPath: null }} onPress={onPress} />,
    );

    await fireEvent.press(getByText("Weird Fishes"));

    expect(onPress).toHaveBeenCalled();
  });
});

describe("playing indicator", () => {
  it("marks the track the player is on", async () => {
    mockCurrentTrack.mockReturnValue({ id: "t-1" });
    mockPlaybackState.mockReturnValue("playing");

    const { getByTestId } = await render(<TrackRow track={TRACK} />);
    expect(getByTestId("track-playing-indicator")).toBeTruthy();
  });

  it("leaves every other track unmarked", async () => {
    mockCurrentTrack.mockReturnValue({ id: "t-2" });
    mockPlaybackState.mockReturnValue("playing");

    const { queryByTestId } = await render(<TrackRow track={TRACK} />);
    expect(queryByTestId("track-playing-indicator")).toBeNull();
  });

  it("compares as strings, because the engine addresses tracks by string id", async () => {
    mockCurrentTrack.mockReturnValue({ id: "7" });
    mockPlaybackState.mockReturnValue("playing");

    const { getByTestId } = await render(
      <TrackRow track={{ ...TRACK, id: 7 as unknown as string }} />,
    );
    expect(getByTestId("track-playing-indicator")).toBeTruthy();
  });

  it("keeps the indicator while paused, so the current track stays identifiable", async () => {
    mockCurrentTrack.mockReturnValue({ id: "t-1" });
    mockPlaybackState.mockReturnValue("paused");

    const { getByTestId } = await render(<TrackRow track={TRACK} />);
    expect(getByTestId("track-playing-indicator")).toBeTruthy();
  });

  it("shows nothing when the player is idle", async () => {
    const { queryByTestId } = await render(<TrackRow track={TRACK} />);
    expect(queryByTestId("track-playing-indicator")).toBeNull();
  });
});
