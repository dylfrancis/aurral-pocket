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

import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import {
  next,
  onProgress,
  onTrackCompleted,
  onTrackStarted,
  pause,
  previous,
  playAlbumFromTrack,
  playItem,
  resume,
  setRepeatMode,
  setShuffle,
} from "@/lib/player/player";
import type { Track } from "@/lib/types/library";
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const manager = callbackManager as jest.Mocked<typeof callbackManager>;

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: "77",
    mbid: "mb-track",
    trackName: "Everything In Its Right Place",
    title: "Everything In Its Right Place",
    trackNumber: 1,
    hasFile: true,
    size: 9_000_000,
    quality: "FLAC",
    streamPath: "/library/canonical-stream/12/77",
    streamFormat: "flac",
    available: true,
    ...overrides,
  };
}

const album = {
  albumTitle: "Kid A",
  artistName: "Radiohead",
  artworkUrl: "https://art.example/kid-a.jpg",
};

type EngineState = Awaited<ReturnType<typeof TrackPlayer.getState>>;

function playerState(overrides: Partial<EngineState> = {}): EngineState {
  return {
    currentTrack: null,
    currentPosition: 0,
    totalDuration: 240,
    currentState: "playing",
    currentPlaylistId: "playlist-1",
    currentIndex: 1,
    currentPlayingType: "playlist",
    ...overrides,
  };
}

const clip = {
  id: "preview-9",
  title: "Idioteque",
  artist: "Radiohead",
  album: "Kid A",
  duration: 0,
  url: "https://preview.example/9.mp3",
  artwork: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  setBaseUrl("https://test.example");
  setAuthToken("test-token-123");
  queue.createPlaylist.mockResolvedValue("playlist-1");
});

describe("playAlbumFromTrack", () => {
  it("queues the whole album in order and starts at the tapped track", async () => {
    const albumTracks = [
      track({ id: "71", trackNumber: 1, streamPath: "/stream/12/71" }),
      track({ id: "72", trackNumber: 2, streamPath: "/stream/12/72" }),
      track({ id: "73", trackNumber: 3, streamPath: "/stream/12/73" }),
    ];

    await expect(
      playAlbumFromTrack(albumTracks, albumTracks[1], album),
    ).resolves.toBe(true);

    // The notification is what drives the lock screen and headset buttons.
    expect(player.configure).toHaveBeenCalledWith(
      expect.objectContaining({ showInNotification: true }),
    );
    // The whole album enters the queue in order — not just the remainder —
    // so previous can walk back past the tapped track and repeat-all cycles
    // the full album.
    expect(queue.addTracksToPlaylist).toHaveBeenCalledWith("playlist-1", [
      expect.objectContaining({ id: "71" }),
      expect.objectContaining({ id: "72" }),
      expect.objectContaining({ id: "73" }),
    ]);
    expect(queue.loadPlaylist).toHaveBeenCalledWith("playlist-1");
    expect(player.playSong).toHaveBeenCalledWith("72", "playlist-1");
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("keeps tracks without a file out of the queue", async () => {
    const albumTracks = [
      track({ id: "71", trackNumber: 1, streamPath: "/stream/12/71" }),
      track({ id: "72", trackNumber: 2, streamPath: null, hasFile: false }),
      track({ id: "73", trackNumber: 3, streamPath: "/stream/12/73" }),
    ];

    await expect(
      playAlbumFromTrack(albumTracks, albumTracks[0], album),
    ).resolves.toBe(true);

    expect(queue.addTracksToPlaylist).toHaveBeenCalledWith("playlist-1", [
      expect.objectContaining({ id: "71" }),
      expect.objectContaining({ id: "73" }),
    ]);
  });

  it("leaves the engine alone when the tapped track has no file", async () => {
    const albumTracks = [
      track({ id: "71", trackNumber: 1, streamPath: null, hasFile: false }),
      track({ id: "72", trackNumber: 2, streamPath: "/stream/12/72" }),
    ];

    await expect(
      playAlbumFromTrack(albumTracks, albumTracks[0], album),
    ).resolves.toBe(false);

    expect(queue.createPlaylist).not.toHaveBeenCalled();
    expect(player.playSong).not.toHaveBeenCalled();
  });
});

describe("playItem", () => {
  it("plays a preview clip through the same engine", async () => {
    await playItem(clip);

    expect(queue.addTracksToPlaylist).toHaveBeenCalledWith("playlist-1", [
      clip,
    ]);
    expect(player.playSong).toHaveBeenCalledWith("preview-9", "playlist-1");
  });

  it("keeps rapid plays in order, so the last tap wins", async () => {
    // Taps are not awaited by the UI. Without serialization two overlapping
    // plays interleave: one adds its track to the other's playlist, or plays
    // against a playlist that was just deleted — and the first tap can finish
    // last, ending playback on the wrong track.
    let resolveFirst!: (id: string) => void;
    queue.createPlaylist
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce("playlist-2");

    const first = playItem(clip);
    const second = playItem({ ...clip, id: "clip-2" });
    await new Promise((resolve) => setImmediate(resolve));
    resolveFirst("playlist-1");
    await Promise.all([first, second]);

    expect(queue.addTracksToPlaylist).toHaveBeenNthCalledWith(1, "playlist-1", [
      expect.objectContaining({ id: "preview-9" }),
    ]);
    expect(queue.addTracksToPlaylist).toHaveBeenNthCalledWith(2, "playlist-2", [
      expect.objectContaining({ id: "clip-2" }),
    ]);
    expect(player.playSong).toHaveBeenLastCalledWith("clip-2", "playlist-2");
  });

  it("replaces what is playing rather than stacking playlists", async () => {
    // One engine holds one thing, so a clip and a library track cannot sound
    // at the same time. Starting either one ends the other.
    await playItem(clip);
    queue.createPlaylist.mockResolvedValue("playlist-2");

    await playAlbumFromTrack([track()], track(), album);

    expect(queue.deletePlaylist).toHaveBeenCalledWith("playlist-1");
    expect(player.playSong).toHaveBeenLastCalledWith("77", "playlist-2");
  });
});

describe("transport", () => {
  it("pauses the engine", async () => {
    await pause();

    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it("resumes the engine", async () => {
    await resume();

    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("advances to the next queued track", async () => {
    await next();

    expect(player.skipToNext).toHaveBeenCalledTimes(1);
  });

  it("goes back one track when the current one just started", async () => {
    player.getState.mockResolvedValue(playerState({ currentPosition: 1 }));

    await previous();

    expect(player.skipToPrevious).toHaveBeenCalledTimes(1);
    expect(player.seek).not.toHaveBeenCalled();
  });

  it("restarts the current track after three seconds of playback", async () => {
    player.getState.mockResolvedValue(playerState({ currentPosition: 10 }));

    await previous();

    expect(player.seek).toHaveBeenCalledWith(0);
    expect(player.skipToPrevious).not.toHaveBeenCalled();
  });

  it.each([
    ["off", "off"],
    ["all", "Playlist"],
    ["one", "track"],
  ] as const)("repeat %s puts the engine in %s mode", async (mode, engine) => {
    await setRepeatMode(mode);

    expect(player.setRepeatMode).toHaveBeenCalledWith(engine);
  });
});

describe("shuffle", () => {
  // Twelve tracks: one already played, one current, ten upcoming. Ten because
  // the shuffle is genuinely random — the odds of it reproducing the album
  // order (a false failure below) are 1 in 10!, about one in 3.6 million.
  const albumIds = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const albumTracks = albumIds.map((id) =>
    track({ id, trackNumber: Number(id), streamPath: `/stream/12/${id}` }),
  );

  // A stateful stand-in for the engine playlist, so the tests assert on the
  // order the queue ends up in — not on which reorder calls produced it.
  let playlistIds: string[] = [];

  beforeEach(async () => {
    playlistIds = [];
    queue.addTracksToPlaylist.mockImplementation((_, tracks) => {
      playlistIds.push(...tracks.map((t) => t.id));
      return Promise.resolve();
    });
    queue.reorderTrackInPlaylist.mockImplementation((_, trackId, newIndex) => {
      playlistIds.splice(playlistIds.indexOf(trackId), 1);
      playlistIds.splice(newIndex, 0, trackId);
      return Promise.resolve();
    });

    await playAlbumFromTrack(albumTracks, albumTracks[1], album);
    // Track "2" is playing: "1" has been heard, "3" through "12" are upcoming.
    player.getState.mockResolvedValue(
      playerState({ currentTrack: { ...clip, id: "2" }, currentIndex: 1 }),
    );
  });

  it("randomizes the upcoming order and leaves the current track alone", async () => {
    await setShuffle(true);

    expect(playlistIds.slice(0, 2)).toEqual(["1", "2"]);
    expect([...playlistIds].sort()).toEqual([...albumIds].sort());
    expect(playlistIds.slice(2)).not.toEqual(albumIds.slice(2));
  });

  it("restores the original order on unshuffle", async () => {
    await setShuffle(true);

    await setShuffle(false);

    expect(playlistIds).toEqual(albumIds);
  });
});

describe("playback events", () => {
  // The facade wires itself into the engine's callback manager once, on the
  // first subscription. Capturing what it registered lets the tests play the
  // engine's part. beforeAll runs before the clearAllMocks in the root
  // beforeEach, so the registration calls are still recorded here.
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

  it("emits track-started when the engine moves onto a track", () => {
    const started: string[] = [];
    const unsubscribe = onTrackStarted((track) => started.push(track.id));

    engine.trackChange({ ...clip, id: "42" }, "user_action");

    expect(started).toEqual(["42"]);
    unsubscribe();
  });

  it("emits progress against the track that is playing", () => {
    const seen: { trackId: string; position: number; duration: number }[] = [];
    const unsubscribe = onProgress((progress) => seen.push(progress));

    engine.trackChange({ ...clip, id: "42" }, "user_action");
    engine.progress(30, 240, false);

    expect(seen).toEqual([{ trackId: "42", position: 30, duration: 240 }]);
    unsubscribe();
  });

  it("emits track-completed when a track plays to its end", () => {
    const completed: string[] = [];
    const unsubscribe = onTrackCompleted((track) => completed.push(track.id));

    engine.trackChange({ ...clip, id: "42" }, "user_action");
    // The engine reports the end of one track as the start of the next,
    // reason "end".
    engine.trackChange({ ...clip, id: "43" }, "end");

    expect(completed).toEqual(["42"]);
    unsubscribe();
  });

  it("does not complete a track the listener skipped away from", () => {
    const completed: string[] = [];
    const unsubscribe = onTrackCompleted((track) => completed.push(track.id));

    engine.trackChange({ ...clip, id: "42" }, "user_action");
    engine.trackChange({ ...clip, id: "43" }, "skip");

    expect(completed).toEqual([]);
    unsubscribe();
  });

  it("completes the last track when the queue runs out", () => {
    const completed: string[] = [];
    const unsubscribe = onTrackCompleted((track) => completed.push(track.id));

    engine.trackChange({ ...clip, id: "42" }, "user_action");
    // No next track to change onto — the engine just stops, reason "end".
    engine.stateChange("stopped", "end");

    expect(completed).toEqual(["42"]);
    unsubscribe();
  });
});
