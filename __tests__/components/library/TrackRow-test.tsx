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
});
