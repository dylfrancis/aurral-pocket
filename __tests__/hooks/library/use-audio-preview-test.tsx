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

import { act, renderHook } from "@testing-library/react-native";
import { useAudioPreview } from "@/hooks/library/use-audio-preview";
import {
  PlayerQueue,
  TrackPlayer,
  useNowPlaying,
} from "react-native-nitro-player";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const nowPlaying = useNowPlaying as jest.MockedFunction<typeof useNowPlaying>;

const IDLE = {
  currentTrack: null,
  currentPosition: 0,
  totalDuration: 0,
  currentState: "stopped" as const,
  currentPlaylistId: null,
  currentIndex: -1,
  currentPlayingType: "not-playing" as const,
};

function sounding(id: string, state: "playing" | "paused" = "playing") {
  nowPlaying.mockReturnValue({
    ...IDLE,
    currentTrack: {
      id,
      title: "",
      artist: "",
      album: "",
      duration: 0,
      url: "",
    },
    currentPosition: 15,
    totalDuration: 30,
    currentState: state,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  nowPlaying.mockReturnValue(IDLE);
  queue.createPlaylist.mockResolvedValue("playlist-1");
});

describe("useAudioPreview", () => {
  it("plays a clip through the player", async () => {
    const { result } = await renderHook(() => useAudioPreview());

    await act(async () => {
      await result.current.toggle("track-1", "https://preview.example/1.mp3");
    });

    expect(queue.addTracksToPlaylist).toHaveBeenCalledWith("playlist-1", [
      expect.objectContaining({
        id: "track-1",
        url: "https://preview.example/1.mp3",
      }),
    ]);
    expect(player.playSong).toHaveBeenCalledWith("track-1", "playlist-1");
  });

  it("pauses the clip that is already sounding instead of restarting it", async () => {
    sounding("track-1");
    const { result } = await renderHook(() => useAudioPreview());

    await act(async () => {
      await result.current.toggle("track-1", "https://preview.example/1.mp3");
    });

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.playSong).not.toHaveBeenCalled();
  });

  it("resumes the clip it had paused", async () => {
    sounding("track-1", "paused");
    const { result } = await renderHook(() => useAudioPreview());

    await act(async () => {
      await result.current.toggle("track-1", "https://preview.example/1.mp3");
    });

    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.playSong).not.toHaveBeenCalled();
  });

  it("reports which clip is sounding and how far it has run", async () => {
    sounding("track-1");

    const { result } = await renderHook(() => useAudioPreview());

    expect(result.current.playingId).toBe("track-1");
    expect(result.current.progress).toBeCloseTo(0.5);
  });

  it("reports nothing playing while the clip is paused", async () => {
    sounding("track-1", "paused");

    const { result } = await renderHook(() => useAudioPreview());

    expect(result.current.playingId).toBeNull();
    expect(result.current.loadingId).toBeNull();
  });

  it("names the clip it is still loading, so the row can show a spinner", async () => {
    // A row that looks idle while the clip downloads invites a second tap.
    nowPlaying.mockReturnValue({
      ...IDLE,
      currentTrack: {
        id: "track-1",
        title: "",
        artist: "",
        album: "",
        duration: 0,
        url: "",
      },
      currentState: "buffering",
    });

    const { result } = await renderHook(() => useAudioPreview());

    expect(result.current.loadingId).toBe("track-1");
    expect(result.current.playingId).toBeNull();
  });

  it("stops the player when the screen asks it to", async () => {
    sounding("track-1");
    const { result } = await renderHook(() => useAudioPreview());

    await act(async () => {
      result.current.stop();
    });

    expect(player.pause).toHaveBeenCalledTimes(1);
  });
});
