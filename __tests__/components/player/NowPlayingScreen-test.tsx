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

const mockNavigate = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ navigate: mockNavigate, back: mockBack })),
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
  artistMbid: "artist-mb-1",
};

const albumTracks = [
  track("1", "Everything In Its Right Place"),
  track("2", "Kid A"),
  track("3", "The National Anthem"),
];

let engine: {
  trackChange: Parameters<typeof manager.subscribeToTrackChange>[0];
  progress: Parameters<typeof manager.subscribeToPlaybackProgressChange>[0];
  stateChange: Parameters<typeof manager.subscribeToPlaybackState>[0];
};

beforeAll(() => {
  onTrackStarted(() => {})();
  engine = {
    trackChange: manager.subscribeToTrackChange.mock.calls[0][0],
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
    expect(getByText("Radiohead · Kid A")).toBeTruthy();
    expect(getByLabelText("Play")).toBeTruthy();
    expect(getByLabelText("Previous track")).toBeTruthy();
    expect(getByLabelText("Next track")).toBeTruthy();

    // Up next lists what follows the current track, in order.
    expect(getByText("Kid A")).toBeTruthy();
    expect(getByText("The National Anthem")).toBeTruthy();
  });

  it("opens the artist page from the artist line, under the sheet", async () => {
    const { getByLabelText } = await renderPlaying();

    await fireEvent.press(getByLabelText("View artist Radiohead"));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(library)/artist/[mbid]",
      params: { mbid: "artist-mb-1" },
    });
  });

  it("seeks when the scrubber is released", async () => {
    const { getByTestId } = await renderPlaying();
    await act(async () => {
      engine.progress(30, 240, false);
    });

    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 120);

    expect(player.seek).toHaveBeenCalledWith(120);
  });

  it("drops the seek target when the track changes", async () => {
    const { getByTestId, getByText } = await renderPlaying();
    await act(async () => {
      engine.progress(30, 240, false);
    });
    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 120);
    expect(getByText("2:00")).toBeTruthy();

    await act(async () => {
      engine.trackChange(
        {
          id: "2",
          title: "Kid A",
          artist: "Radiohead",
          album: "Kid A",
          duration: 0,
          url: "https://test.example/2",
          artwork: null,
        },
        "skip",
      );
    });

    // The new track starts over; 2:00 belonged to the old one.
    expect(getByText("0:00")).toBeTruthy();
  });

  it("lets the ticks take over again when a seek fails", async () => {
    const { getByTestId, getByText } = await renderPlaying();
    await act(async () => {
      engine.progress(30, 240, false);
    });
    player.seek.mockRejectedValueOnce(new Error("engine gone"));

    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 120);
    await act(async () => {});

    expect(getByText("0:30")).toBeTruthy();
  });

  it("keeps a newer seek target when an older seek fails late", async () => {
    const { getByTestId, getByText } = await renderPlaying();
    await act(async () => {
      engine.progress(30, 240, false);
    });

    let rejectFirstSeek!: (error: Error) => void;
    player.seek.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirstSeek = reject;
        }),
    );

    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 120);
    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 200);
    await act(async () => {
      rejectFirstSeek(new Error("engine gone"));
    });

    // The failure belonged to the 2:00 seek; the 3:20 target stays.
    expect(getByText("3:20")).toBeTruthy();
  });

  it("shows nothing up next when the playing item is not in the queue", async () => {
    const { getByText } = await renderPlaying();

    // A clip mid-transition: the engine reports an item the facade never
    // queued, so no queue position exists.
    await act(async () => {
      engine.trackChange(
        {
          id: "unqueued-clip",
          title: "Preview",
          artist: "Radiohead",
          album: "Kid A",
          duration: 0,
          url: "https://preview.example/9.mp3",
          artwork: null,
        },
        "user_action",
      );
    });

    expect(getByText("Nothing up next.")).toBeTruthy();
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
