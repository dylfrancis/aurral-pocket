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
  addToQueue,
  forgetQueue,
  next,
  onProgress,
  onTrackCompleted,
  onTrackStarted,
  pause,
  pauseClip,
  playNextInQueue,
  previous,
  playAlbumFromTrack,
  playItem,
  playQueueItem,
  resume,
  seekTo,
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
  albumMbid: "album-mb-1",
  artistMbid: "artist-mb-1",
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

  it("queues just the tapped track when the list does not contain it", async () => {
    // A stale or still-loading track list must not produce silence: playSong
    // with an id that is not in the playlist plays nothing yet reports true.
    const albumTracks = [
      track({ id: "71", trackNumber: 1, streamPath: "/stream/12/71" }),
    ];
    const tapped = track({
      id: "99",
      trackNumber: 9,
      streamPath: "/stream/12/99",
    });

    await expect(playAlbumFromTrack(albumTracks, tapped, album)).resolves.toBe(
      true,
    );

    expect(queue.addTracksToPlaylist).toHaveBeenCalledWith("playlist-1", [
      expect.objectContaining({ id: "99" }),
    ]);
    expect(player.playSong).toHaveBeenCalledWith("99", "playlist-1");
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

  it("seeks within the current track", async () => {
    await seekTo(87);

    expect(player.seek).toHaveBeenCalledWith(87);
  });

  it("pauseClip leaves album playback alone", async () => {
    // The preview surfaces fire their stop on blur and on navigation. Album
    // playback must survive those moments.
    await playAlbumFromTrack([track()], track(), album);

    await pauseClip();

    expect(player.pause).not.toHaveBeenCalled();
  });

  it("pauseClip pauses a playing clip", async () => {
    await playItem(clip);

    await pauseClip();

    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it("jumps to a queued track inside the current playlist", async () => {
    await playItem(clip);

    await playQueueItem("preview-9");

    // The queue stays as it is — no playlist rebuild, just a jump.
    expect(queue.createPlaylist).toHaveBeenCalledTimes(1);
    expect(player.playSong).toHaveBeenLastCalledWith("preview-9", "playlist-1");
    expect(player.play).toHaveBeenCalledTimes(2);
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
      // Each play builds a fresh playlist, so arrival replaces the old order.
      playlistIds = tracks.map((t) => t.id);
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

  it("keeps shuffle on when a new play rebuilds the queue", async () => {
    await setShuffle(true);

    await playAlbumFromTrack(albumTracks, albumTracks[0], album);

    expect(playlistIds[0]).toBe("1");
    expect([...playlistIds].sort()).toEqual([...albumIds].sort());
    expect(playlistIds.slice(1)).not.toEqual(albumIds.slice(1));

    // And unshuffle still restores the new queue's album order.
    await setShuffle(false);
    expect(playlistIds).toEqual(albumIds);
  });
});

describe("queue edits", () => {
  const albumTracks = [
    track({ id: "71", trackNumber: 1, streamPath: "/stream/12/71" }),
    track({ id: "72", trackNumber: 2, streamPath: "/stream/12/72" }),
    track({ id: "73", trackNumber: 3, streamPath: "/stream/12/73" }),
  ];
  const otherAlbum = {
    ...album,
    albumTitle: "Amnesiac",
    albumMbid: "album-mb-2",
  };
  const otherTracks = [
    track({ id: "81", trackNumber: 1, streamPath: "/stream/13/81" }),
    track({ id: "82", trackNumber: 2, streamPath: "/stream/13/82" }),
  ];

  // A stateful stand-in for the engine playlist, indexed inserts included,
  // so the tests assert on the order the queue ends up in.
  let playlistIds: string[] = [];

  beforeEach(async () => {
    playlistIds = [];
    queue.createPlaylist.mockImplementation(() => {
      playlistIds = [];
      return Promise.resolve("playlist-1");
    });
    queue.addTracksToPlaylist.mockImplementation((_, tracks, index) => {
      const ids = tracks.map((t) => t.id);
      playlistIds.splice(index ?? playlistIds.length, 0, ...ids);
      return Promise.resolve();
    });
    queue.reorderTrackInPlaylist.mockImplementation((_, trackId, newIndex) => {
      playlistIds.splice(playlistIds.indexOf(trackId), 1);
      playlistIds.splice(newIndex, 0, trackId);
      return Promise.resolve();
    });

    // Track "72" is current: replaceAndPlay shows the started track itself.
    await playAlbumFromTrack(albumTracks, albumTracks[1], album);
    player.getState.mockResolvedValue(
      playerState({ currentTrack: { ...clip, id: "72" }, currentIndex: 1 }),
    );
  });

  it("playNextInQueue inserts right after the current track", async () => {
    await expect(playNextInQueue(otherTracks, otherAlbum)).resolves.toBe(2);

    expect(playlistIds).toEqual(["71", "72", "81", "82", "73"]);
  });

  it("addToQueue appends to the end", async () => {
    await expect(addToQueue(otherTracks, otherAlbum)).resolves.toBe(2);

    expect(playlistIds).toEqual(["71", "72", "73", "81", "82"]);
  });

  it("drops tracks the queue already holds and counts only the rest", async () => {
    const mixed = [
      track({ id: "73", trackNumber: 3, streamPath: "/stream/12/73" }),
      otherTracks[0],
    ];

    await expect(addToQueue(mixed, otherAlbum)).resolves.toBe(1);

    expect(playlistIds).toEqual(["71", "72", "73", "81"]);
  });

  it("returns zero and leaves the engine alone when nothing is playable", async () => {
    const unplayable = [
      track({ id: "90", streamPath: null, hasFile: false, available: false }),
    ];
    queue.addTracksToPlaylist.mockClear();

    await expect(addToQueue(unplayable, otherAlbum)).resolves.toBe(0);

    expect(queue.addTracksToPlaylist).not.toHaveBeenCalled();
    expect(playlistIds).toEqual(["71", "72", "73"]);
  });

  it("starts a fresh play when nothing is queued", async () => {
    await forgetQueue();

    await expect(playNextInQueue(otherTracks, otherAlbum)).resolves.toBe(2);

    expect(playlistIds).toEqual(["81", "82"]);
    expect(player.playSong).toHaveBeenCalledWith("81", "playlist-1");
  });

  it("keeps a play-next insertion in place after unshuffle", async () => {
    await setShuffle(true);
    await playNextInQueue(otherTracks, otherAlbum);

    await setShuffle(false);

    // The original order holds the insertion right after the track that was
    // current when it happened.
    expect(playlistIds).toEqual(["71", "72", "81", "82", "73"]);
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
    // The facade wires once per module. If an earlier subscription beat this
    // one, clearAllMocks already wiped the calls and the captures below would
    // throw a bare TypeError — fail with the cause instead.
    expect(manager.subscribeToTrackChange).toHaveBeenCalledTimes(1);
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

  // iOS calls a track running out "skip" — the same word it uses for the next
  // button. The position is what tells them apart.
  it("completes a track the engine calls a skip at its end", () => {
    const completed: string[] = [];
    const unsubscribe = onTrackCompleted((track) => completed.push(track.id));

    engine.trackChange({ ...clip, id: "42" }, "user_action");
    engine.progress(239.2, 240, false);
    engine.trackChange({ ...clip, id: "43" }, "skip");

    expect(completed).toEqual(["42"]);
    unsubscribe();
  });

  it("does not complete a track the listener skipped away from", () => {
    const completed: string[] = [];
    const unsubscribe = onTrackCompleted((track) => completed.push(track.id));

    engine.trackChange({ ...clip, id: "42" }, "user_action");
    engine.progress(120, 240, false);
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

  it("completes the last track when the engine only pauses at its end", () => {
    // iOS never reports the queue running out: the player pauses at the final
    // track's end with no reason, exactly like a user pause. The position
    // tells them apart.
    const completed: string[] = [];
    const unsubscribe = onTrackCompleted((track) => completed.push(track.id));

    engine.trackChange({ ...clip, id: "42" }, "user_action");
    engine.progress(239.2, 240, false);
    engine.stateChange("paused", undefined);

    expect(completed).toEqual(["42"]);
    unsubscribe();
  });

  it("does not complete a track paused midway", () => {
    const completed: string[] = [];
    const unsubscribe = onTrackCompleted((track) => completed.push(track.id));

    engine.trackChange({ ...clip, id: "42" }, "user_action");
    engine.progress(120, 240, false);
    engine.stateChange("paused", undefined);

    expect(completed).toEqual([]);
    unsubscribe();
  });
});
