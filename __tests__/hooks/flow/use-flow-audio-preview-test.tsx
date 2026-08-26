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

jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(),
}));

import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { useAuth } from "@/contexts/auth-context";
import {
  FlowAudioPreviewProvider,
  useFlowAudioPreview,
} from "@/hooks/flow/use-flow-audio-preview";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import {
  PlayerQueue,
  TrackPlayer,
  useNowPlaying,
} from "react-native-nitro-player";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const nowPlaying = useNowPlaying as jest.MockedFunction<typeof useNowPlaying>;
const mockUseAuth = useAuth as jest.Mock;

const IDLE = {
  currentTrack: null,
  currentPosition: 0,
  totalDuration: 0,
  currentState: "stopped" as const,
  currentPlaylistId: null,
  currentIndex: -1,
  currentPlayingType: "not-playing" as const,
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <FlowAudioPreviewProvider>{children}</FlowAudioPreviewProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  nowPlaying.mockReturnValue(IDLE);
  queue.createPlaylist.mockResolvedValue("playlist-1");
  setBaseUrl("https://test.example");
  setAuthToken("test-token-123");
  mockUseAuth.mockReturnValue({ token: "test-token-123" });
});

describe("useFlowAudioPreview", () => {
  it("streams the job with the token in the URL, because the engine sends no headers", async () => {
    const { result } = await renderHook(() => useFlowAudioPreview(), {
      wrapper,
    });

    await act(async () => {
      await result.current.toggle("job-9");
    });

    expect(queue.addTracksToPlaylist).toHaveBeenCalledWith("playlist-1", [
      expect.objectContaining({
        id: "job-9",
        url: "https://test.example/api/playlists/stream/job-9?token=test-token-123",
      }),
    ]);
    expect(player.playSong).toHaveBeenCalledWith("job-9", "playlist-1");
  });

  it("pauses the job that is already sounding", async () => {
    nowPlaying.mockReturnValue({
      ...IDLE,
      currentTrack: {
        id: "job-9",
        title: "",
        artist: "",
        album: "",
        duration: 0,
        url: "",
      },
      currentState: "playing",
    });
    const { result } = await renderHook(() => useFlowAudioPreview(), {
      wrapper,
    });

    await act(async () => {
      await result.current.toggle("job-9");
    });

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.playSong).not.toHaveBeenCalled();
  });

  it("reports the job that is sounding and how far it has run", async () => {
    nowPlaying.mockReturnValue({
      ...IDLE,
      currentTrack: {
        id: "job-9",
        title: "",
        artist: "",
        album: "",
        duration: 0,
        url: "",
      },
      currentPosition: 30,
      totalDuration: 120,
      currentState: "playing",
    });

    const { result } = await renderHook(() => useFlowAudioPreview(), {
      wrapper,
    });

    expect(result.current.activeJobId).toBe("job-9");
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.progress).toBeCloseTo(0.25);
  });

  it("reports buffering before the first sound arrives", async () => {
    nowPlaying.mockReturnValue({
      ...IDLE,
      currentTrack: {
        id: "job-9",
        title: "",
        artist: "",
        album: "",
        duration: 0,
        url: "",
      },
      currentState: "buffering",
    });

    const { result } = await renderHook(() => useFlowAudioPreview(), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPlaying).toBe(false);
  });

  it("plays nothing while signed out", async () => {
    setAuthToken(null);
    mockUseAuth.mockReturnValue({ token: null });
    const { result } = await renderHook(() => useFlowAudioPreview(), {
      wrapper,
    });

    await act(async () => {
      await result.current.toggle("job-9");
    });

    expect(player.playSong).not.toHaveBeenCalled();
  });
});
