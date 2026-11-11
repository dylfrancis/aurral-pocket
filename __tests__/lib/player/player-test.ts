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
import { setAuthToken, setBaseUrl, setCustomHeaders } from "@/lib/api/client";
import {
  addToQueue,
  forgetQueue,
  next,
  onProgress,
  onTrackStarted,
  pause,
  pauseClip,
  playNextInQueue,
  previous,
  playAlbumFromTrack,
  refreshQueueHeaders,
  refreshQueueUrls,
  playItem,
  playQueueFrom,
  playQueueItem,
  resume,
  seekTo,
  setQueuedAlbumCovers,
  setRepeatMode,
  setShuffle,
  useCurrentTrack,
  useQueue,
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
  coverPath: null,
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
    expect(queue.loadPlaylist).toHaveBeenCalledWith("playlist-1", 1);
    // Another start after the load would play the track from the top again.
    expect(player.playSong).not.toHaveBeenCalled();
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
    // A stale or still-loading track list must not fail the play: the engine
    // refuses to start a track that is not in the playlist.
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
    expect(queue.loadPlaylist).toHaveBeenCalledWith("playlist-1", 0);
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
    expect(player.play).not.toHaveBeenCalled();
  });
});

describe("custom headers", () => {
  const PROXY = { "CF-Access-Client-Id": "id.access" };
  const serverAlbum = { ...album, coverPath: "/api/library/albums/12/cover" };

  afterEach(() => setCustomHeaders({}));

  it("go with a server track's stream and cover, and never with a Deezer clip", async () => {
    setCustomHeaders(PROXY);

    await playAlbumFromTrack([track()], track(), serverAlbum);
    expect(queue.addTracksToPlaylist).toHaveBeenLastCalledWith("playlist-1", [
      expect.objectContaining({
        extraPayload: { headers: PROXY, artworkHeaders: PROXY },
      }),
    ]);

    await playItem(clip);
    const [clipTrack] = queue.addTracksToPlaylist.mock.lastCall![1];
    expect(clipTrack).not.toHaveProperty("extraPayload");
  });

  it("reach tracks already queued when they change", async () => {
    setCustomHeaders(PROXY);
    const albumTracks = [
      track({ id: "71", streamPath: "/stream/12/71" }),
      track({ id: "72", streamPath: "/stream/12/72" }),
    ];
    await playAlbumFromTrack(albumTracks, albumTracks[0], serverAlbum);

    const rotated = { "CF-Access-Client-Id": "rotated.access" };
    setCustomHeaders(rotated);
    await refreshQueueHeaders();

    const payload = { headers: rotated, artworkHeaders: rotated };
    expect(player.updateTracks).toHaveBeenCalledWith([
      expect.objectContaining({ id: "71", extraPayload: payload }),
      expect.objectContaining({ id: "72", extraPayload: payload }),
    ]);
  });
});

describe("playItem", () => {
  it("plays a preview clip through the same engine", async () => {
    await playItem(clip);

    expect(queue.addTracksToPlaylist).toHaveBeenCalledWith("playlist-1", [
      clip,
    ]);
    expect(queue.loadPlaylist).toHaveBeenCalledWith("playlist-1", 0);
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
    expect(queue.loadPlaylist).toHaveBeenLastCalledWith("playlist-2", 0);
  });

  it("replaces what is playing rather than stacking playlists", async () => {
    // One engine holds one thing, so a clip and a library track cannot sound
    // at the same time. Starting either one ends the other.
    await playItem(clip);
    queue.createPlaylist.mockResolvedValue("playlist-2");

    await playAlbumFromTrack([track()], track(), album);

    expect(queue.deletePlaylist).toHaveBeenCalledWith("playlist-1");
    expect(queue.loadPlaylist).toHaveBeenLastCalledWith("playlist-2", 0);
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

  it("pauseClip leaves a playlist's queue alone", async () => {
    const playlistTrack = {
      ...clip,
      streamPath: "/playlists/stream/job-1",
      coverPath: null,
      trackMbid: null,
      artistMbid: null,
      albumMbid: null,
      favorite: null,
    };
    await playQueueFrom([playlistTrack], playlistTrack.id, album);

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
    expect(queue.loadPlaylist).toHaveBeenLastCalledWith("playlist-1", 0);
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

  describe("when a new token replaces the queue's URLs", () => {
    const albumTracks = [
      track({ id: "71", trackNumber: 1, streamPath: "/stream/12/71" }),
      track({ id: "72", trackNumber: 2, streamPath: "/stream/12/72" }),
    ];

    /** The engine playing track 72, this far in. */
    async function listenTo72(position: number) {
      await forgetQueue();
      await playAlbumFromTrack(albumTracks, albumTracks[1], album);
      engine.trackChange({ ...clip, id: "72" }, "user_action");
      engine.progress(position, 240, false);
      jest.clearAllMocks();
      setAuthToken("new-token");
    }

    it("keeps playing, and goes back to its place once the track is ready", async () => {
      await listenTo72(42);
      engine.stateChange("playing", undefined);

      await refreshQueueUrls();
      expect(player.play).toHaveBeenCalledTimes(1);
      player.seek.mockClear();

      // The engine ignored the seek it got while the track was loading.
      engine.progress(0, 240, false);
      expect(player.seek).toHaveBeenCalledTimes(1);
      expect(player.seek).toHaveBeenCalledWith(42);

      // Once only: repeat-one coming back around must not jump to 42 again.
      engine.progress(1, 240, false);
      expect(player.seek).toHaveBeenCalledTimes(1);
    });

    it("leaves a rebuilt track alone when the engine kept its place", async () => {
      await listenTo72(42);
      engine.stateChange("playing", undefined);

      await refreshQueueUrls();
      player.seek.mockClear();
      engine.progress(42, 240, false);

      expect(player.seek).not.toHaveBeenCalled();
    });

    it("lets a seek by the listener win over the rebuilt track's place", async () => {
      await listenTo72(42);
      engine.stateChange("playing", undefined);

      await refreshQueueUrls();
      await seekTo(100);
      player.seek.mockClear();
      engine.progress(100, 240, false);

      expect(player.seek).not.toHaveBeenCalled();
    });

    it("stays paused at the same place", async () => {
      await listenTo72(42);
      engine.stateChange("paused", undefined);

      await refreshQueueUrls();

      expect(player.play).not.toHaveBeenCalled();
      player.seek.mockClear();

      // Like a restored queue: the place is asked for again on play, when the
      // track is ready, and not by a report that arrives while it sits paused.
      engine.progress(0, 240, false);
      expect(player.seek).not.toHaveBeenCalled();
      await resume();
      expect(player.seek).toHaveBeenCalledWith(42);
      expect(player.play).toHaveBeenCalledTimes(1);
    });

    // Listening time belongs to the play in progress, so the rebuilt track
    // must not reset it, even when the track was about to end.
    it("carries on the same play instead of starting one", async () => {
      await listenTo72(239);
      engine.stateChange("playing", undefined);
      const started: string[] = [];
      const unsubscribe = onTrackStarted((item) => started.push(item.id));

      // The old stream's last report, then the rebuilt playlist's track, which
      // is the same one.
      queue.loadPlaylist.mockImplementationOnce(async () => {
        engine.progress(239, 240, false);
        engine.trackChange({ ...clip, id: "72" }, "skip");
      });

      await refreshQueueUrls();
      engine.progress(0, 240, false);
      engine.progress(239, 240, true);

      expect(started).toEqual([]);
      unsubscribe();
    });

    it("isn't thrown off its place by a report from the old stream", async () => {
      await listenTo72(42);
      engine.stateChange("playing", undefined);
      queue.addTracksToPlaylist.mockImplementationOnce(async () => {
        engine.progress(43, 240, false);
      });

      await refreshQueueUrls();
      player.seek.mockClear();
      engine.progress(0, 240, false);

      expect(player.seek).toHaveBeenCalledWith(42);
    });

    it("starts a queue that played out from the top of its last track", async () => {
      await listenTo72(240);
      engine.stateChange("stopped", "end");

      await refreshQueueUrls();

      expect(queue.loadPlaylist).toHaveBeenCalledWith("playlist-1", 1);
      expect(player.seek).not.toHaveBeenCalled();
    });

    it("can still play after a rebuild that failed partway", async () => {
      await listenTo72(42);
      queue.createPlaylist.mockRejectedValueOnce(new Error("engine said no"));

      await expect(refreshQueueUrls()).rejects.toThrow("engine said no");
      queue.deletePlaylist.mockClear();
      await playAlbumFromTrack(albumTracks, albumTracks[0], album);

      // The rebuild already deleted the old one.
      expect(queue.deletePlaylist).not.toHaveBeenCalled();
      expect(queue.loadPlaylist).toHaveBeenLastCalledWith("playlist-1", 0);
      expect(player.play).toHaveBeenCalled();
    });
  });

  it("emits track-started when the engine moves onto a track", () => {
    const started: string[] = [];
    const unsubscribe = onTrackStarted((track) => started.push(track.id));

    engine.trackChange({ ...clip, id: "42" }, "user_action");

    expect(started).toEqual(["42"]);
    unsubscribe();
  });

  it("keeps showing the started track while the album loads", async () => {
    const albumTracks = [
      track({ id: "71", trackNumber: 1, streamPath: "/stream/12/71" }),
      track({ id: "72", trackNumber: 2, streamPath: "/stream/12/72" }),
      track({ id: "73", trackNumber: 3, streamPath: "/stream/12/73" }),
    ];
    // Given no index, the engine loads from the top and reports the first
    // track. The load holds here so the screen renders what that event left.
    let finishLoad!: () => void;
    queue.loadPlaylist.mockImplementationOnce((_, index = 0) => {
      engine.trackChange({ ...clip, id: albumTracks[index].id }, "skip");
      return new Promise((resolve) => {
        finishLoad = resolve;
      });
    });
    const { result } = await renderHook(useCurrentTrack);

    let play!: Promise<boolean>;
    await act(async () => {
      play = playAlbumFromTrack(albumTracks, albumTracks[2], album);
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(result.current?.id).toBe("73");

    await act(async () => {
      finishLoad();
      await play;
    });
  });

  it("emits progress against the track that is playing", () => {
    const seen: unknown[] = [];
    const unsubscribe = onProgress((progress) => seen.push(progress));

    engine.trackChange({ ...clip, id: "42" }, "user_action");
    engine.progress(30, 240, undefined);
    engine.progress(90, 240, true);

    expect(seen).toEqual([
      {
        track: expect.objectContaining({ id: "42" }),
        position: 30,
        duration: 240,
        seeked: false,
      },
      {
        track: expect.objectContaining({ id: "42" }),
        position: 90,
        duration: 240,
        seeked: true,
      },
    ]);
    unsubscribe();
  });

  describe("on repeat-one", () => {
    beforeEach(() => setRepeatMode("one"));
    afterEach(() => setRepeatMode("off"));

    // Repeat-one stays on the track, so no track change reports the new start.
    it.each([
      { engineReport: "an unflagged fall from the end", from: 239.5 },
      { engineReport: "a seek flag from the end", from: 239.5, flag: true },
      { engineReport: "a fall short of an estimated end", from: 230 },
    ])(
      "emits track-started when the track loops with $engineReport",
      ({ from, flag }) => {
        const started: string[] = [];
        const unsubscribe = onTrackStarted((track) => started.push(track.id));

        engine.trackChange({ ...clip, id: "42" }, "user_action");
        engine.progress(from, 240, undefined);
        engine.progress(0.4, 240, flag);

        expect(started).toEqual(["42", "42"]);
        unsubscribe();
      },
    );

    it.each([
      { seekBack: "to the start", to: 0, flag: true },
      { seekBack: "elsewhere, unflagged", to: 60 },
    ])(
      "does not emit track-started for a seek back $seekBack",
      ({ to, flag }) => {
        const started: string[] = [];
        const unsubscribe = onTrackStarted((track) => started.push(track.id));

        engine.trackChange({ ...clip, id: "42" }, "user_action");
        engine.progress(120, 240, undefined);
        engine.progress(to, 240, flag);

        expect(started).toEqual(["42"]);
        unsubscribe();
      },
    );
  });

  it("does not emit track-started for a seek back from the end without a repeat", () => {
    const started: string[] = [];
    const unsubscribe = onTrackStarted((track) => started.push(track.id));

    engine.trackChange({ ...clip, id: "42" }, "user_action");
    engine.progress(239.5, 240, undefined);
    engine.progress(0, 240, true);

    expect(started).toEqual(["42"]);
    unsubscribe();
  });
});

describe("setQueuedAlbumCovers", () => {
  const COVER = "https://img.example/kid-a.jpg";

  function queued(
    id: string,
    albumMbid: string,
    artwork: string | null = null,
  ) {
    return {
      ...clip,
      id,
      url: `https://test.example/api/playlists/stream/${id}`,
      artwork,
      streamPath: `/playlists/stream/${id}`,
      coverPath: null,
      trackMbid: null,
      artistMbid: null,
      albumMbid,
      favorite: null,
    };
  }

  async function queuedCovers() {
    const { result } = await renderHook(() => useQueue());
    return result.current.items.map((item) => item.artwork);
  }

  it("gives the album's tracks their cover, in the app and on the lock screen", async () => {
    await playQueueFrom(
      [queued("a", "album-1"), queued("b", "album-1"), queued("c", "album-2")],
      "a",
      album,
    );

    await setQueuedAlbumCovers(new Map([["album-1", COVER]]));

    const { result } = await renderHook(() => useCurrentTrack());
    expect(result.current?.artwork).toBe(COVER);
    expect(await queuedCovers()).toEqual([COVER, COVER, null]);
    // The same URLs, or the engine would refuse the change for the playing track.
    expect(player.updateTracks).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "a",
        artwork: COVER,
        url: "https://test.example/api/playlists/stream/a",
      }),
      expect.objectContaining({ id: "b", artwork: COVER }),
    ]);
  });

  it("keeps the covers when shuffle restores the original order", async () => {
    await playQueueFrom(
      [queued("a", "album-1"), queued("b", "album-1")],
      "a",
      album,
    );
    await setShuffle(true);

    await setQueuedAlbumCovers(new Map([["album-1", COVER]]));
    await setShuffle(false);

    expect(await queuedCovers()).toEqual([COVER, COVER]);
  });

  it("leaves a track that already has one", async () => {
    const own = "https://img.example/own.jpg";
    await playQueueFrom([queued("a", "album-1", own)], "a", album);

    await setQueuedAlbumCovers(new Map([["album-1", COVER]]));

    expect(await queuedCovers()).toEqual([own]);
    expect(player.updateTracks).not.toHaveBeenCalled();
  });

  it("does nothing for an album that's no longer queued", async () => {
    await playQueueFrom([queued("a", "album-1")], "a", album);

    await setQueuedAlbumCovers(new Map([["album-9", COVER]]));

    expect(await queuedCovers()).toEqual([null]);
    expect(player.updateTracks).not.toHaveBeenCalled();
  });
});

describe("refreshQueueUrls", () => {
  const albumTracks = [
    track({ id: "71", trackNumber: 1, streamPath: "/stream/12/71" }),
    track({ id: "72", trackNumber: 2, streamPath: "/stream/12/72" }),
  ];

  beforeEach(async () => {
    await forgetQueue();
    await playAlbumFromTrack(albumTracks, albumTracks[1], album);
    jest.clearAllMocks();
    queue.createPlaylist.mockResolvedValue("playlist-2");
  });

  it("rebuilds the queue on the new token, on the same track", async () => {
    setAuthToken("new-token");

    await refreshQueueUrls();

    expect(queue.addTracksToPlaylist).toHaveBeenCalledWith("playlist-2", [
      expect.objectContaining({
        id: "71",
        url: "https://test.example/api/stream/12/71?token=new-token",
      }),
      expect.objectContaining({
        id: "72",
        url: "https://test.example/api/stream/12/72?token=new-token",
      }),
    ]);
    expect(queue.loadPlaylist).toHaveBeenCalledWith("playlist-2", 1);
  });

  it("does nothing while the token is the same", async () => {
    await refreshQueueUrls();

    expect(queue.createPlaylist).not.toHaveBeenCalled();
  });

  it("keeps the queue as it is after sign-out, with no token to give it", async () => {
    setAuthToken(null);

    await refreshQueueUrls();

    expect(queue.createPlaylist).not.toHaveBeenCalled();
  });

  it("has nothing to rebuild once sign-out has forgotten the queue", async () => {
    await forgetQueue();
    jest.clearAllMocks();
    setAuthToken("next-accounts-token");

    await refreshQueueUrls();

    expect(queue.createPlaylist).not.toHaveBeenCalled();
  });

  it("leaves a preview clip alone, since its URL carries no token", async () => {
    await forgetQueue();
    await playItem(clip);
    jest.clearAllMocks();
    setAuthToken("new-token");

    await refreshQueueUrls();

    expect(queue.createPlaylist).not.toHaveBeenCalled();
  });
});
