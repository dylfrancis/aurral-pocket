jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// The restore tests load the facade again, which re-runs every mock factory
// too. The doubles are held outside their factories so both the test and the
// facade under test keep watching the same ones.
const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
jest.mock("@react-native-async-storage/async-storage", () => mockStorage);

const mockFetch = jest.fn();
jest.mock("expo/fetch", () => ({ fetch: mockFetch }));

const mockQueue = {
  createPlaylist: jest.fn(() => Promise.resolve("playlist-1")),
  deletePlaylist: jest.fn(() => Promise.resolve()),
  addTracksToPlaylist: jest.fn(() => Promise.resolve()),
  loadPlaylist: jest.fn(() => Promise.resolve()),
  reorderTrackInPlaylist: jest.fn(() => Promise.resolve()),
};
const mockPlayer = {
  configure: jest.fn(() => Promise.resolve()),
  playSong: jest.fn(() => Promise.resolve()),
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(() => Promise.resolve()),
  skipToNext: jest.fn(() => Promise.resolve()),
  skipToPrevious: jest.fn(() => Promise.resolve()),
  seek: jest.fn(() => Promise.resolve()),
  setRepeatMode: jest.fn(() => Promise.resolve()),
  getState: jest.fn(() => Promise.resolve({ currentPosition: 0 })),
};
jest.mock("react-native-nitro-player", () => ({
  PlayerQueue: mockQueue,
  TrackPlayer: mockPlayer,
  useNowPlaying: jest.fn(),
}));

const mockManager = {
  subscribeToTrackChange: jest.fn(() => () => {}),
  subscribeToPlaybackState: jest.fn(() => () => {}),
  subscribeToPlaybackProgressChange: jest.fn(() => () => {}),
};
jest.mock("react-native-nitro-player/src/hooks/callbackManager", () => ({
  callbackManager: mockManager,
}));

import { renderHook } from "@testing-library/react-native";
import type { Track } from "@/lib/types/library";

// Required, not imported: an import hoists above the doubles above, and the
// factories that close over them would hand the facade undefined.
const { setAuthToken, setBaseUrl } =
  require("@/lib/api/client") as typeof import("@/lib/api/client");
const facade =
  require("@/lib/player/player") as typeof import("@/lib/player/player");

type Facade = typeof facade;

const QUEUE_KEY = "playback_queue";
const STREAM_ROOT = "https://test.example/api";

const album = {
  albumTitle: "Kid A",
  artistName: "Radiohead",
  artworkUrl: "https://art.example/kid-a.jpg",
  artistMbid: "artist-mb-1",
};

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
    streamPath: `/library/canonical-stream/12/${id}`,
    streamFormat: "flac",
    available: true,
  };
}

const albumTracks = [
  track("71", "Everything In Its Right Place"),
  track("72", "Kid A"),
  track("73", "The National Anthem"),
];

function savedRecord(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    items: albumTracks.map((item) => ({
      id: item.id,
      title: item.trackName,
      artist: "Radiohead",
      album: "Kid A",
      artwork: album.artworkUrl,
      streamPath: item.streamPath,
    })),
    originalIds: ["71", "72", "73"],
    currentId: "72",
    positionSeconds: 96,
    durationSeconds: 214,
    album,
    shuffle: false,
    repeat: "off",
    ...overrides,
  });
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function savedQueues(): Record<string, unknown>[] {
  return mockStorage.setItem.mock.calls
    .filter(([key]: [string]) => key === QUEUE_KEY)
    .map(([, json]: [string, string]) => JSON.parse(json));
}

function lastSavedQueue(): Record<string, unknown> {
  const saved = savedQueues();
  return saved[saved.length - 1];
}

function engineTrack(id: string) {
  return { id, title: "", artist: "", album: "", duration: 0 };
}

function queuedTracks(): { id: string; url: string }[] {
  const calls = mockQueue.addTracksToPlaylist.mock.calls as unknown as [
    string,
    { id: string; url: string }[],
  ][];
  return calls[0][1];
}

function queuedIds(): string[] {
  return queuedTracks().map((item) => item.id);
}

function lastCallback<T>(subscribe: jest.Mock): T {
  const calls = subscribe.mock.calls as unknown as [T][];
  return calls[calls.length - 1][0];
}

function engineCallbacks() {
  return {
    trackChange: lastCallback<(engineTrack: unknown, reason?: string) => void>(
      mockManager.subscribeToTrackChange,
    ),
    progress: lastCallback<(position: number, duration: number) => void>(
      mockManager.subscribeToPlaybackProgressChange,
    ),
  };
}

/** Captured once: each test clears what the mocks recorded. */
let engine: ReturnType<typeof engineCallbacks>;

beforeAll(() => {
  // Wiring is lazy — a subscription registers the engine callbacks.
  facade.onTrackStarted(() => {})();
  engine = engineCallbacks();
});

async function freshFacade(): Promise<Facade> {
  let loaded: Facade | null = null;
  await jest.isolateModulesAsync(async () => {
    const client = require("@/lib/api/client");
    client.setBaseUrl("https://test.example");
    client.setAuthToken("restored-token");
    loaded = require("@/lib/player/player");
    loaded!.onTrackStarted(() => {})();
  });
  return loaded!;
}

beforeEach(() => {
  jest.clearAllMocks();
  setBaseUrl("https://test.example");
  setAuthToken("test-token-123");
  mockQueue.createPlaylist.mockResolvedValue("playlist-1");
  mockStorage.getItem.mockResolvedValue(null);
  mockFetch.mockResolvedValue({ status: 206 });
});

/*
 * These two run first, on the shared facade: it is the only one whose hooks
 * can be read, because the isolated registry below loads its own React. It
 * has played nothing yet, so it is as cold as a restart leaves it.
 */
describe("what a restored player shows", () => {
  it("shows the saved position against the saved length", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());

    await expect(facade.restoreSavedQueue()).resolves.toBe(true);

    // Without the saved length the scrubber shows a full bar and no time.
    const { result } = await renderHook(() => facade.useProgress());
    expect(result.current).toEqual({ position: 96, duration: 214 });
  });

  it("keeps the length when the engine loads the restored track", async () => {
    engine.trackChange({
      id: "72",
      title: "Kid A",
      artist: "Radiohead",
      album: "Kid A",
      duration: 0,
    });

    const { result } = await renderHook(() => facade.useProgress());
    expect(result.current).toEqual({ position: 96, duration: 214 });
  });
});

describe("saving the queue", () => {
  it("writes the queue and the track it started on", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[1], album);
    await flush();

    const saved = lastSavedQueue();
    expect(saved).toMatchObject({
      version: 1,
      currentId: "72",
      originalIds: ["71", "72", "73"],
      album,
      shuffle: false,
      repeat: "off",
    });
    // The path, not the URL: a URL's token dies with the session.
    expect(saved.items).toEqual([
      expect.objectContaining({
        id: "71",
        streamPath: "/library/canonical-stream/12/71",
      }),
      expect.objectContaining({ id: "72" }),
      expect.objectContaining({ id: "73" }),
    ]);
    expect(saved.items).not.toContainEqual(
      expect.objectContaining({ url: expect.anything() }),
    );
  });

  it("hands the engine its own shape, without the saved path", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);

    expect(queuedTracks()[0]).not.toHaveProperty("streamPath");
    expect(queuedTracks()[0]).toMatchObject({
      id: "71",
      url: `${STREAM_ROOT}/library/canonical-stream/12/71?token=test-token-123`,
    });
  });

  it("writes the position every few seconds, not every tick", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);
    await flush();
    const before = savedQueues().length;

    engine.trackChange({
      id: "71",
      title: "",
      artist: "",
      album: "",
      duration: 0,
    });
    for (let second = 1; second <= 6; second++) {
      engine.progress(second, 300);
    }
    await flush();

    const saved = savedQueues();
    expect(saved.length).toBe(before + 1);
    expect(saved[saved.length - 1]).toMatchObject({ positionSeconds: 5 });
  });

  it("writes the position when playback pauses", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);
    engine.trackChange({
      id: "71",
      title: "",
      artist: "",
      album: "",
      duration: 0,
    });
    engine.progress(42, 300);

    await facade.pause();
    await flush();

    expect(lastSavedQueue()).toMatchObject({
      positionSeconds: 42,
      durationSeconds: 300,
    });
  });

  it("writes a new queue at the start of its track", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);
    engine.trackChange({
      id: "71",
      title: "",
      artist: "",
      album: "",
      duration: 0,
    });
    engine.progress(96, 300);

    await facade.playAlbumFromTrack(albumTracks, albumTracks[2], album);
    await flush();

    expect(lastSavedQueue()).toMatchObject({
      currentId: "73",
      positionSeconds: 0,
    });
  });

  it("writes a new track against its own position", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);
    engine.trackChange(engineTrack("71"));
    engine.progress(150, 300);
    await flush();

    engine.trackChange(engineTrack("72"), "end");
    await flush();

    expect(lastSavedQueue()).toMatchObject({
      currentId: "72",
      positionSeconds: 0,
    });
  });

  it("does not write a preview clip", async () => {
    await facade.playItem({
      id: "preview-9",
      title: "Idioteque",
      artist: "Radiohead",
      album: "Kid A",
      duration: 0,
      url: "https://preview.example/9.mp3",
      artwork: null,
    });
    await flush();

    expect(savedQueues()).toHaveLength(0);
  });
});

describe("restoring the queue", () => {
  it("brings the queue back paused at the saved position", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());
    const player = await freshFacade();

    await expect(player.restoreSavedQueue()).resolves.toBe(true);

    expect(queuedIds()).toEqual(["71", "72", "73"]);
    expect(queuedTracks()[1].url).toBe(
      `${STREAM_ROOT}/library/canonical-stream/12/72?token=restored-token`,
    );
    expect(mockQueue.loadPlaylist).toHaveBeenCalledWith("playlist-1", 1);
    expect(mockPlayer.playSong).not.toHaveBeenCalled();
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.seek).toHaveBeenCalledWith(96);
  });

  it("resumes from the restored position", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());
    const player = await freshFacade();
    await player.restoreSavedQueue();
    mockPlayer.seek.mockClear();

    await player.togglePlayback();

    expect(mockPlayer.seek).toHaveBeenCalledWith(96);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.seek.mock.invocationCallOrder[0]).toBeLessThan(
      mockPlayer.play.mock.invocationCallOrder[0],
    );
  });

  it("asks for the position once, not on every later play", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());
    const player = await freshFacade();
    await player.restoreSavedQueue();
    await player.togglePlayback();
    await player.pause();
    mockPlayer.seek.mockClear();

    await player.togglePlayback();

    expect(mockPlayer.seek).not.toHaveBeenCalled();
  });

  it("drops a track the server no longer streams", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve({ status: url.includes("/73") ? 404 : 206 }),
    );
    const player = await freshFacade();

    await expect(player.restoreSavedQueue()).resolves.toBe(true);

    expect(queuedIds()).toEqual(["71", "72"]);
  });

  it("keeps every track when the server cannot be reached", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());
    mockFetch.mockRejectedValue(new Error("offline"));
    const player = await freshFacade();

    await expect(player.restoreSavedQueue()).resolves.toBe(true);

    expect(queuedTracks()).toHaveLength(3);
  });

  it("starts at the head when the saved track is one of the dropped", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve({ status: url.includes("/72") ? 404 : 206 }),
    );
    const player = await freshFacade();

    await player.restoreSavedQueue();

    expect(mockQueue.loadPlaylist).toHaveBeenCalledWith("playlist-1", 0);
    expect(mockPlayer.seek).not.toHaveBeenCalled();
  });

  it("forgets a queue whose tracks have all gone", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());
    mockFetch.mockResolvedValue({ status: 404 });
    const player = await freshFacade();

    await expect(player.restoreSavedQueue()).resolves.toBe(false);

    expect(mockQueue.createPlaylist).not.toHaveBeenCalled();
    expect(mockStorage.removeItem).toHaveBeenCalledWith(QUEUE_KEY);
  });

  it("ignores a position and a length that are not finite", async () => {
    mockStorage.getItem.mockResolvedValue(
      savedRecord()
        .replace('"positionSeconds":96', '"positionSeconds":1e400')
        .replace('"durationSeconds":214', '"durationSeconds":1e400'),
    );
    const player = await freshFacade();

    await expect(player.restoreSavedQueue()).resolves.toBe(true);

    expect(mockPlayer.seek).not.toHaveBeenCalled();
  });

  it("ignores a record written by another version", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord({ version: 99 }));
    const player = await freshFacade();

    await expect(player.restoreSavedQueue()).resolves.toBe(false);
    expect(mockQueue.createPlaylist).not.toHaveBeenCalled();
  });

  it("restores the shuffled order and the repeat mode", async () => {
    mockStorage.getItem.mockResolvedValue(
      savedRecord({
        items: [
          {
            id: "73",
            title: "The National Anthem",
            artist: "Radiohead",
            album: "Kid A",
            artwork: null,
            streamPath: "/library/canonical-stream/12/73",
          },
          {
            id: "71",
            title: "Everything In Its Right Place",
            artist: "Radiohead",
            album: "Kid A",
            artwork: null,
            streamPath: "/library/canonical-stream/12/71",
          },
        ],
        originalIds: ["71", "73"],
        currentId: "73",
        shuffle: true,
        repeat: "all",
      }),
    );
    const player = await freshFacade();

    await player.restoreSavedQueue();

    expect(queuedIds()).toEqual(["73", "71"]);
    expect(mockPlayer.setRepeatMode).toHaveBeenCalledWith("Playlist");
  });

  it("leaves a playing queue alone", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());
    const player = await freshFacade();
    await player.playAlbumFromTrack(albumTracks, albumTracks[0], album);
    mockQueue.createPlaylist.mockClear();

    await expect(player.restoreSavedQueue()).resolves.toBe(false);
    expect(mockQueue.createPlaylist).not.toHaveBeenCalled();
  });
});

describe("forgetting the queue", () => {
  it("stops the player and empties the queue", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);

    await facade.forgetQueue();
    await flush();

    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockQueue.deletePlaylist).toHaveBeenCalledWith("playlist-1");
    expect(mockStorage.removeItem).toHaveBeenCalledWith(QUEUE_KEY);

    const { result } = await renderHook(() => facade.useHasQueue());
    expect(result.current).toBe(false);
  });

  it("outlasts a save that has not landed yet", async () => {
    // A store, because what matters is the order the writes land in, not the
    // order they were called in.
    const store: Record<string, string> = {};
    let landWrite = () => {};
    const pending = new Promise<void>((resolve) => {
      landWrite = resolve;
    });
    mockStorage.setItem
      .mockImplementationOnce(async (key: string, value: string) => {
        await pending;
        store[key] = value;
      })
      .mockImplementation(async (key: string, value: string) => {
        store[key] = value;
      });
    mockStorage.removeItem.mockImplementation(async (key: string) => {
      delete store[key];
    });

    // The play queues a write that is slow to land.
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);
    const forgetting = facade.forgetQueue();
    landWrite();
    await forgetting;
    await flush();

    expect(store[QUEUE_KEY]).toBeUndefined();
  });
});
