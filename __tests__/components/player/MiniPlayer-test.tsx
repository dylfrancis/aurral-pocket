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

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { onTrackStarted, playItem } from "@/lib/player/player";
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const manager = callbackManager as jest.Mocked<typeof callbackManager>;

const clip = {
  id: "preview-9",
  title: "Idioteque",
  artist: "Radiohead",
  album: "Kid A",
  duration: 0,
  url: "https://preview.example/9.mp3",
  artwork: null,
};

let engineStateChange: Parameters<typeof manager.subscribeToPlaybackState>[0];

beforeAll(() => {
  onTrackStarted(() => {})();
  engineStateChange = manager.subscribeToPlaybackState.mock.calls[0][0];
});

beforeEach(() => {
  jest.clearAllMocks();
  queue.createPlaylist.mockResolvedValue("playlist-1");
});

describe("MiniPlayer", () => {
  it("renders nothing before anything has played", async () => {
    const { toJSON } = await render(<MiniPlayer />);

    expect(toJSON()).toBeNull();
  });

  it("shows the current track and opens the player on tap", async () => {
    const { getByText, getByLabelText } = await render(<MiniPlayer />);
    await act(() => playItem(clip));

    expect(getByText("Idioteque")).toBeTruthy();
    expect(getByText("Radiohead")).toBeTruthy();

    await fireEvent.press(
      getByLabelText("Idioteque by Radiohead. Open the player."),
    );
    expect(mockPush).toHaveBeenCalledWith("/now-playing");
  });

  it("pauses when playing and resumes when paused", async () => {
    const { getByLabelText } = await render(<MiniPlayer />);
    await act(() => playItem(clip));

    await act(async () => {
      engineStateChange("playing", undefined);
    });
    await fireEvent.press(getByLabelText("Pause"));
    expect(player.pause).toHaveBeenCalledTimes(1);

    await act(async () => {
      engineStateChange("paused", undefined);
    });
    player.play.mockClear();
    await fireEvent.press(getByLabelText("Play"));
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("skips to the next track from the bar", async () => {
    const { getByLabelText } = await render(<MiniPlayer />);
    await act(() => playItem(clip));

    await fireEvent.press(getByLabelText("Next track"));

    expect(player.skipToNext).toHaveBeenCalledTimes(1);
  });

  it("drops the labels in the compact layout", async () => {
    const { queryByText } = await render(<MiniPlayer compact />);
    await act(() => playItem(clip));

    expect(queryByText("Idioteque")).toBeNull();
  });
});
