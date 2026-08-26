jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { TrackRow } from "@/components/library/TrackRow";
import type { Track } from "@/lib/types/library";

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

  it("renders the track name and number without a handler", async () => {
    const { getByText } = await render(<TrackRow track={TRACK} />);
    expect(getByText("Weird Fishes")).toBeTruthy();
    expect(getByText("4")).toBeTruthy();
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

  it("stays silent for a track Aurral cannot stream", async () => {
    // Lidarr owns the file but Aurral cannot read it. The row keeps its
    // checkmark and its quality badge. Tapping it must do nothing.
    const onPress = jest.fn();
    const { getByText } = await render(
      <TrackRow track={{ ...TRACK, streamPath: null }} onPress={onPress} />,
    );

    await fireEvent.press(getByText("Weird Fishes"));

    expect(onPress).not.toHaveBeenCalled();
  });
});
