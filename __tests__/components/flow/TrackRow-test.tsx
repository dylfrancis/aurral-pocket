jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockUpgradeMutate = jest.fn();
const mockUpgradeMutation = { mutate: mockUpgradeMutate, isPending: false };

jest.mock("@/hooks/flow", () => ({
  useFlowAudioPreview: jest.fn(() => ({
    activeJobId: null,
    isPlaying: false,
    progress: 0,
    toggle: jest.fn(),
    stop: jest.fn(),
  })),
  useQueueTrackQualityUpgrade: jest.fn(() => mockUpgradeMutation),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { TrackRow } from "@/components/flow/TrackRow";
import type { FlowJob } from "@/lib/types/flow";

const BASE_JOB: FlowJob = {
  id: "job-1",
  playlistType: "pl-1",
  artistName: "Radiohead",
  trackName: "Weird Fishes",
  albumName: "In Rainbows",
  artistMbid: null,
  status: "done",
};

describe("TrackRow quality display", () => {
  beforeEach(() => {
    mockUpgradeMutate.mockClear();
  });

  it("shows the quality label when the server sends one", async () => {
    const { getByText } = await render(
      <TrackRow
        job={{
          ...BASE_JOB,
          qualityLabel: "FLAC standard",
          qualityState: "preferred",
        }}
      />,
    );
    expect(getByText("FLAC standard")).toBeTruthy();
  });

  it("hides the badge when the server could not classify the file", async () => {
    const { queryByText } = await render(
      <TrackRow
        job={{ ...BASE_JOB, qualityLabel: "Unknown", qualityState: "upgrade" }}
      />,
    );
    expect(queryByText("Unknown")).toBeNull();
  });

  it("hides the badge on servers that predate quality profiles", async () => {
    const { queryByText } = await render(<TrackRow job={BASE_JOB} />);
    expect(queryByText("Unknown")).toBeNull();
  });
});

describe("TrackRow upgrade action", () => {
  beforeEach(() => {
    mockUpgradeMutate.mockClear();
  });

  it("queues an upgrade for an eligible track", async () => {
    const { getByLabelText } = await render(
      <TrackRow
        job={{ ...BASE_JOB, qualityLabel: "MP3 128", qualityState: "upgrade" }}
      />,
    );
    fireEvent.press(
      getByLabelText("Search for a quality upgrade of Weird Fishes"),
    );
    expect(mockUpgradeMutate).toHaveBeenCalledWith(
      { playlistId: "pl-1", jobId: "job-1" },
      expect.anything(),
    );
  });

  it("offers no upgrade for a track at the preferred tier", async () => {
    const { queryByLabelText } = await render(
      <TrackRow
        job={{
          ...BASE_JOB,
          qualityLabel: "FLAC standard",
          qualityState: "preferred",
        }}
      />,
    );
    expect(
      queryByLabelText("Search for a quality upgrade of Weird Fishes"),
    ).toBeNull();
  });

  it("offers no upgrade for an unfinished track", async () => {
    const { queryByLabelText } = await render(
      <TrackRow job={{ ...BASE_JOB, status: "downloading" }} />,
    );
    expect(
      queryByLabelText("Search for a quality upgrade of Weird Fishes"),
    ).toBeNull();
  });
});
