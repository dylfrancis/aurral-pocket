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

jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  getLibraryFavorites: jest.fn(),
  updateLibraryFavorites: jest.fn(),
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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NowPlayingScreen } from "@/components/player/NowPlayingScreen";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import { getLibraryFavorites, updateLibraryFavorites } from "@/lib/api/library";
import {
  onTrackStarted,
  playAlbumFromTrack,
  playQueueFrom,
} from "@/lib/player/player";
import type { Track } from "@/lib/types/library";
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const manager = callbackManager as jest.Mocked<typeof callbackManager>;
const mockGetLibraryFavorites = getLibraryFavorites as jest.Mock;
const mockUpdateLibraryFavorites = updateLibraryFavorites as jest.Mock;

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
  coverPath: null,
  artworkUrl: "https://art.example/kid-a.jpg",
  albumMbid: "album-mb-1",
  artistMbid: "artist-mb-1",
};

const albumTracks = [
  track("1", "Everything In Its Right Place"),
  track("2", "Kid A"),
  track("3", "The National Anthem"),
];

function favoritesWith(...tracks: { identityKey: string }[]) {
  return { artists: [], albums: [], tracks };
}

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
  mockGetLibraryFavorites.mockResolvedValue(favoritesWith());
  mockUpdateLibraryFavorites.mockResolvedValue({ changedIds: [] });
});

// The player keeps its track between tests, so even a first render can show the
// favorite button, which needs a query client.
function renderScreen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <NowPlayingScreen />
    </QueryClientProvider>,
  );
}

async function renderPlaying() {
  const utils = await renderScreen();
  await act(() => playAlbumFromTrack(albumTracks, albumTracks[0], album));
  return utils;
}

describe("NowPlayingScreen favorite button", () => {
  const nude = { ...track("9", "Nude"), identityKey: "recording:nude" };

  async function renderPlayingNude() {
    const utils = await renderScreen();
    await act(() => playAlbumFromTrack([nude], nude, album));
    return utils;
  }

  it("adds the playing track to favorites", async () => {
    const { findByLabelText } = await renderPlayingNude();

    await fireEvent.press(await findByLabelText("Add Nude to favorites"));

    expect(mockUpdateLibraryFavorites).toHaveBeenCalledWith(
      ["song:recording:nude"],
      true,
    );
  });

  it("removes a track that is already a favorite", async () => {
    mockGetLibraryFavorites.mockResolvedValue(
      favoritesWith({ identityKey: "recording:nude" }),
    );
    const { findByLabelText } = await renderPlayingNude();

    await fireEvent.press(await findByLabelText("Remove Nude from favorites"));

    expect(mockUpdateLibraryFavorites).toHaveBeenCalledWith(
      ["song:recording:nude"],
      false,
    );
  });

  it("fills the heart on the tap, before the server answers", async () => {
    let finishToggle = (_value: unknown) => {};
    mockUpdateLibraryFavorites.mockReturnValueOnce(
      new Promise((resolve) => {
        finishToggle = resolve;
      }),
    );
    const { findByLabelText } = await renderPlayingNude();

    await fireEvent.press(await findByLabelText("Add Nude to favorites"));

    expect(await findByLabelText("Remove Nude from favorites")).toBeTruthy();

    // Left pending, the mutation keeps Jest from exiting.
    await act(async () => {
      finishToggle({ changedIds: [] });
    });
  });

  it("empties the heart again when the server refuses", async () => {
    mockUpdateLibraryFavorites.mockRejectedValueOnce(new Error("refused"));
    const { findByLabelText } = await renderPlayingNude();

    await fireEvent.press(await findByLabelText("Add Nude to favorites"));

    expect(await findByLabelText("Add Nude to favorites")).toBeTruthy();
    expect(mockUpdateLibraryFavorites).toHaveBeenCalledTimes(1);
  });

  it("ignores a tap until it knows whether the track is a favorite", async () => {
    mockGetLibraryFavorites.mockReturnValue(new Promise(() => {}));
    const { findByLabelText } = await renderPlayingNude();

    await fireEvent.press(await findByLabelText("Add Nude to favorites"));

    expect(mockUpdateLibraryFavorites).not.toHaveBeenCalled();
  });

  it("shows no heart for a track the favorites API can't address", async () => {
    const { queryByLabelText } = await renderPlaying();

    expect(queryByLabelText(/favorites$/)).toBeNull();
  });
});

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

  it("opens a playlist track's own artist, with no album to show", async () => {
    const { getByLabelText, getByText } = await renderScreen();
    await act(() =>
      playQueueFrom(
        [
          {
            id: "job-1",
            title: "Alison",
            artist: "Slowdive",
            album: "",
            duration: 0,
            url: "https://test.example/api/playlists/stream/job-1",
            artwork: null,
            streamPath: "/playlists/stream/job-1",
            coverPath: null,
            trackMbid: null,
            artistMbid: "slowdive-mb",
            albumMbid: null,
            identityKey: null,
          },
        ],
        "job-1",
        {
          albumTitle: "Road Trip",
          artistName: "",
          coverPath: null,
          artworkUrl: null,
          albumMbid: null,
          artistMbid: null,
        },
      ),
    );

    expect(getByText("Slowdive")).toBeTruthy();
    await fireEvent.press(getByLabelText("View artist Slowdive"));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(library)/artist/[mbid]",
      params: { mbid: "slowdive-mb" },
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
