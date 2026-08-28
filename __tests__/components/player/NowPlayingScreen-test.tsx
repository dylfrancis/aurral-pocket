jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

// The community slider ships no Jest mock; a plain View exposes the same
// callback props to fireEvent.
jest.mock("@react-native-community/slider", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockSlider(props: any) {
    return React.createElement(View, { ...props, testID: "scrubber-slider" });
  };
});

import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { NowPlayingScreen } from "@/components/player/NowPlayingScreen";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import { onTrackStarted, playAlbumFromTrack } from "@/lib/player/player";
import type { Track } from "@/lib/types/library";
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const manager = callbackManager as jest.Mocked<typeof callbackManager>;

function track(id: string, name: string): Track {
  return {
    id,
    mbid: `mb-${id}`,
    trackName: name,
    title: name,
    trackNumber: Number(id),
    hasFile: true,
    size: 9_000_000,
    quality: "FLAC",
    streamPath: `/stream/12/${id}`,
    streamFormat: "flac",
    available: true,
  };
}

const album = {
  albumTitle: "Kid A",
  artistName: "Radiohead",
  artworkUrl: "https://art.example/kid-a.jpg",
};

const albumTracks = [
  track("1", "Everything In Its Right Place"),
  track("2", "Kid A"),
  track("3", "The National Anthem"),
];

let engine: {
  progress: Parameters<typeof manager.subscribeToPlaybackProgressChange>[0];
  stateChange: Parameters<typeof manager.subscribeToPlaybackState>[0];
};

beforeAll(() => {
  onTrackStarted(() => {})();
  engine = {
    progress: manager.subscribeToPlaybackProgressChange.mock.calls[0][0],
    stateChange: manager.subscribeToPlaybackState.mock.calls[0][0],
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  setBaseUrl("https://test.example");
  setAuthToken("test-token-123");
  queue.createPlaylist.mockResolvedValue("playlist-1");
});

async function renderPlaying() {
  const utils = await render(<NowPlayingScreen />);
  await act(() => playAlbumFromTrack(albumTracks, albumTracks[0], album));
  return utils;
}

describe("NowPlayingScreen", () => {
  it("shows artwork metadata, transport, and the up-next list", async () => {
    const { getByText, getByLabelText } = await renderPlaying();

    expect(getByText("Everything In Its Right Place")).toBeTruthy();
    expect(getByText("Radiohead — Kid A")).toBeTruthy();
    expect(getByLabelText("Play")).toBeTruthy();
    expect(getByLabelText("Previous track")).toBeTruthy();
    expect(getByLabelText("Next track")).toBeTruthy();

    // Up next lists what follows the current track, in order.
    expect(getByText("Kid A")).toBeTruthy();
    expect(getByText("The National Anthem")).toBeTruthy();
  });

  it("seeks when the scrubber is released", async () => {
    const { getByTestId } = await renderPlaying();
    await act(async () => {
      engine.progress(30, 240, false);
    });

    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 120);

    expect(player.seek).toHaveBeenCalledWith(120);
  });

  it("plays a tapped up-next track without rebuilding the queue", async () => {
    const { getByLabelText } = await renderPlaying();
    player.playSong.mockClear();
    queue.createPlaylist.mockClear();

    await fireEvent.press(
      getByLabelText("Play The National Anthem by Radiohead"),
    );

    expect(player.playSong).toHaveBeenCalledWith("3", "playlist-1");
    expect(queue.createPlaylist).not.toHaveBeenCalled();
  });

  it("cycles repeat from off through the queue to one track", async () => {
    const { getByLabelText } = await renderPlaying();

    await fireEvent.press(getByLabelText("Repeat: off"));
    expect(player.setRepeatMode).toHaveBeenLastCalledWith("Playlist");

    await fireEvent.press(getByLabelText("Repeat: all"));
    expect(player.setRepeatMode).toHaveBeenLastCalledWith("track");

    await fireEvent.press(getByLabelText("Repeat: one"));
    expect(player.setRepeatMode).toHaveBeenLastCalledWith("off");
  });

  it("marks shuffle selected once toggled", async () => {
    const { getByLabelText } = await renderPlaying();

    await fireEvent.press(getByLabelText("Shuffle"));

    expect(getByLabelText("Shuffle").props.accessibilityState?.selected).toBe(
      true,
    );
  });

  it("swaps the play control for pause while playing", async () => {
    const { getByLabelText } = await renderPlaying();

    await act(async () => {
      engine.stateChange("playing", undefined);
    });

    await fireEvent.press(getByLabelText("Pause"));
    expect(player.pause).toHaveBeenCalledTimes(1);
  });
});
