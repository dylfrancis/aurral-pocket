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
import {
  onTrackStarted,
  playItem,
  playQueueItem,
  setRepeatMode,
  setShuffle,
  togglePlayback,
  useCurrentTrack,
  useHasQueue,
  usePlaybackState,
  usePlayerModes,
  useProgress,
  useQueue,
} from "@/lib/player/player";
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

// The facade wires itself into the engine's callback manager once, on the
// first subscription. Capturing what it registered lets the tests play the
// engine's part — same setup as player-test.ts.
let engine: {
  trackChange: Parameters<typeof manager.subscribeToTrackChange>[0];
  progress: Parameters<typeof manager.subscribeToPlaybackProgressChange>[0];
  stateChange: Parameters<typeof manager.subscribeToPlaybackState>[0];
};

beforeAll(() => {
  onTrackStarted(() => {})();
  expect(manager.subscribeToTrackChange).toHaveBeenCalledTimes(1);
  engine = {
    trackChange: manager.subscribeToTrackChange.mock.calls[0][0],
    progress: manager.subscribeToPlaybackProgressChange.mock.calls[0][0],
    stateChange: manager.subscribeToPlaybackState.mock.calls[0][0],
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  queue.createPlaylist.mockResolvedValue("playlist-1");
});

// This suite gets its own module instance, so this ignore case sees a
// facade that has never played — player-test.ts plays before transport runs.
it("ignores a queue jump before anything has played", async () => {
  await playQueueItem("preview-9");

  expect(player.playSong).not.toHaveBeenCalled();
});

describe("useCurrentTrack", () => {
  it("shows the tapped track as soon as a play starts", async () => {
    const { result } = await renderHook(useCurrentTrack);

    await act(() => playItem(clip));

    expect(result.current?.id).toBe("preview-9");
  });

  it("follows the engine onto the next track", async () => {
    const { result } = await renderHook(useCurrentTrack);

    await act(async () => {
      engine.trackChange({ ...clip, id: "43" }, "skip");
    });

    expect(result.current?.id).toBe("43");
  });

  it("keeps showing the finished track when the queue runs out", async () => {
    const { result } = await renderHook(useCurrentTrack);

    await act(async () => {
      engine.trackChange({ ...clip, id: "42" }, "user_action");
      engine.progress(239.2, 240, false);
      engine.stateChange("paused", undefined);
    });

    expect(result.current?.id).toBe("42");
  });

  it("does not re-render on a progress tick", async () => {
    let renders = 0;
    await renderHook(() => {
      renders += 1;
      return useCurrentTrack();
    });
    await act(async () => {
      engine.trackChange({ ...clip, id: "42" }, "user_action");
    });
    const rendersAfterTrackChange = renders;

    await act(async () => {
      engine.progress(10.2, 240, false);
      engine.progress(11.4, 240, false);
    });

    expect(renders).toBe(rendersAfterTrackChange);
  });
});

describe("usePlaybackState", () => {
  it("follows the engine's state events", async () => {
    const { result } = await renderHook(usePlaybackState);

    await act(async () => {
      engine.stateChange("playing", undefined);
    });
    expect(result.current).toBe("playing");

    await act(async () => {
      engine.stateChange("paused", undefined);
    });
    expect(result.current).toBe("paused");
  });
});

describe("useProgress", () => {
  it("reports position and duration", async () => {
    const { result } = await renderHook(useProgress);

    await act(async () => {
      engine.trackChange({ ...clip, id: "42" }, "user_action");
      engine.progress(30.4, 240, false);
    });

    expect(result.current).toEqual({ position: 30.4, duration: 240 });
  });

  it("renders once per whole second, not once per engine tick", async () => {
    let renders = 0;
    const { result } = await renderHook(() => {
      renders += 1;
      return useProgress();
    });
    await act(async () => {
      engine.trackChange({ ...clip, id: "42" }, "user_action");
      engine.progress(10.1, 240, false);
    });
    const rendersAtTen = renders;

    // Still second 10 — no display change, so no render.
    await act(async () => {
      engine.progress(10.4, 240, false);
      engine.progress(10.8, 240, false);
    });
    expect(renders).toBe(rendersAtTen);

    await act(async () => {
      engine.progress(11.2, 240, false);
    });
    expect(renders).toBe(rendersAtTen + 1);
    expect(result.current.position).toBe(11.2);
  });

  it("resets to the start when the track changes", async () => {
    const { result } = await renderHook(useProgress);
    await act(async () => {
      engine.trackChange({ ...clip, id: "42" }, "user_action");
      engine.progress(120, 240, false);
    });

    await act(async () => {
      engine.trackChange({ ...clip, id: "43" }, "skip");
    });

    expect(result.current.position).toBe(0);
  });
});

describe("useQueue", () => {
  it("lists the queued tracks and the one the player is on", async () => {
    const { result } = await renderHook(useQueue);

    await act(() => playItem(clip));

    expect(result.current.items.map((item) => item.id)).toEqual(["preview-9"]);
    expect(result.current.currentId).toBe("preview-9");
  });

  it("moves currentId as the engine advances", async () => {
    const { result } = await renderHook(useQueue);
    await act(() => playItem(clip));

    await act(async () => {
      engine.trackChange({ ...clip, id: "43" }, "end");
    });

    expect(result.current.currentId).toBe("43");
  });
});

describe("useHasQueue", () => {
  it("turns true once something is queued and stays true after it ends", async () => {
    const { result } = await renderHook(useHasQueue);

    await act(() => playItem(clip));
    expect(result.current).toBe(true);

    await act(async () => {
      engine.progress(239.5, 240, false);
      engine.stateChange("paused", undefined);
    });
    expect(result.current).toBe(true);
  });
});

describe("togglePlayback", () => {
  it("pauses while playing and resumes while paused mid-track", async () => {
    await act(() => playItem(clip));
    await act(async () => {
      engine.trackChange(clip, "user_action");
      engine.stateChange("playing", undefined);
    });

    await togglePlayback();
    expect(player.pause).toHaveBeenCalledTimes(1);

    await act(async () => {
      engine.progress(120, 240, false);
      engine.stateChange("paused", undefined);
    });
    player.play.mockClear();
    await togglePlayback();
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.playSong).toHaveBeenCalledTimes(1);
  });

  it("restarts the finished track instead of resuming into silence", async () => {
    await act(() => playItem(clip));
    await act(async () => {
      engine.trackChange(clip, "user_action");
      // iOS reports the queue running out as a plain pause at the end.
      engine.progress(239.5, 240, false);
      engine.stateChange("paused", undefined);
    });
    player.playSong.mockClear();

    await togglePlayback();

    expect(player.playSong).toHaveBeenCalledWith("preview-9", "playlist-1");
  });
});

describe("usePlayerModes", () => {
  it("reflects shuffle and repeat as they are set", async () => {
    const { result } = await renderHook(usePlayerModes);

    await act(() => setShuffle(true));
    expect(result.current).toEqual({ shuffle: true, repeat: "off" });

    await act(() => setRepeatMode("one"));
    expect(result.current).toEqual({ shuffle: true, repeat: "one" });

    await act(() => setShuffle(false));
    expect(result.current).toEqual({ shuffle: false, repeat: "one" });
  });
});
