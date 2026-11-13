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

// What's saved on the phone, and whether there's a connection.
const mockPhone = { saved: new Map<string, string>(), offline: false };
jest.mock("@/lib/offline/saved-library", () => ({
  savedFilePath: (id: string) => mockPhone.saved.get(id) ?? null,
  canPlayNow: (id: string) => !mockPhone.offline || mockPhone.saved.has(id),
  savedLibraryReady: () => Promise.resolve(),
}));
jest.mock("@/lib/offline/network", () => ({
  isOffline: () => mockPhone.offline,
  networkKnown: () => Promise.resolve(),
  onNetworkChange: () => () => {},
}));

const mockQueue = {
  createPlaylist: jest.fn(() => Promise.resolve("playlist-1")),
  deletePlaylist: jest.fn((_id: string) => Promise.resolve()),
  getAllPlaylists: jest.fn((): { id: string }[] => []),
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
  updateTracks: jest.fn(() => Promise.resolve()),
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
  coverPath: null,
  artworkUrl: "https://art.example/kid-a.jpg",
  albumMbid: "album-mb-1",
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
      coverPath: null,
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

/** A playlist the engine holds, as its playlist list reports it. */
function enginePlaylist(id: string) {
  return { id, name: "Aurral", tracks: [engineTrack(id)] };
}

function deletedPlaylistIds(): string[] {
  return mockQueue.deletePlaylist.mock.calls.map(([id]) => id);
}

function queuedTracks(): { id: string; url: string; artwork: string | null }[] {
  const calls = mockQueue.addTracksToPlaylist.mock.calls as unknown as [
    string,
    { id: string; url: string; artwork: string | null }[],
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
  // Reset, not cleared: a list queued for a call that never came must not
  // reach the next test.
  mockQueue.getAllPlaylists.mockReset().mockReturnValue([]);
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
  it("keeps a cover that was found after the queue started", async () => {
    const cover = "https://img.example/kid-a.jpg";
    await facade.playQueueFrom(
      [
        {
          id: "job-1",
          title: "Kid A",
          artist: "Radiohead",
          album: "Kid A",
          duration: 0,
          url: "https://test.example/api/playlists/stream/job-1",
          artwork: null,
          streamPath: "/playlists/stream/job-1",
          coverPath: null,
          trackMbid: null,
          artistMbid: null,
          albumMbid: "album-1",
          favorite: null,
        },
      ],
      "job-1",
      album,
    );

    await facade.setQueuedAlbumCovers(new Map([["album-1", cover]]));
    await flush();

    expect((lastSavedQueue().items as { artwork: string }[])[0].artwork).toBe(
      cover,
    );
  });

  it("keeps a playlist's history choice through a restart", async () => {
    await facade.playQueueFrom(
      [
        {
          id: "job-1",
          title: "Kid A",
          artist: "Radiohead",
          album: "Kid A",
          duration: 0,
          url: `${STREAM_ROOT}/playlists/stream/job-1`,
          artwork: null,
          streamPath: "/playlists/stream/job-1",
          coverPath: null,
          trackMbid: null,
          artistMbid: null,
          albumMbid: null,
          favorite: null,
          recordHistory: false,
        },
      ],
      "job-1",
      album,
    );
    await flush();
    const saved = lastSavedQueue();
    mockStorage.getItem.mockResolvedValue(
      JSON.stringify({ ...saved, currentId: "job-1" }),
    );
    mockStorage.setItem.mockClear();

    const restarted = await freshFacade();
    await restarted.restoreSavedQueue();
    await flush();

    expect(lastSavedQueue().items).toEqual([
      expect.objectContaining({ id: "job-1", recordHistory: false }),
    ]);
  });

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

  // A play is reported when a track ends, which can be after a restart.
  it("writes the ids a reported play carries", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[1], album);
    await flush();

    expect(lastSavedQueue().items).toContainEqual(
      expect.objectContaining({
        id: "72",
        trackMbid: "mb-72",
        artistMbid: "artist-mb-1",
        albumMbid: "album-mb-1",
      }),
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

  it("gives the engine the cover with a token, and saves only its path", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], {
      ...album,
      coverPath: "/api/library/albums/12/cover?v=abc",
    });
    await flush();

    expect(queuedTracks()[0].artwork).toBe(
      "https://test.example/api/library/albums/12/cover?v=abc&token=test-token-123",
    );
    const saved = savedQueues().at(-1)!;
    expect((saved.items as Record<string, unknown>[])[0].coverPath).toBe(
      "/api/library/albums/12/cover?v=abc",
    );
    expect(JSON.stringify(saved)).not.toContain("test-token-123");
  });

  it("gives the engine the MBID image for an album with no cover path", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);

    expect(queuedTracks()[0].artwork).toBe(album.artworkUrl);
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

  it("deletes the playlists an earlier process left before building its own", async () => {
    // The engine loads its saved playlists back at start, every track's
    // stream URL and session token included.
    mockStorage.getItem.mockResolvedValue(savedRecord());
    mockQueue.getAllPlaylists.mockReturnValueOnce([
      enginePlaylist("stale-1"),
      enginePlaylist("stale-2"),
    ]);
    const player = await freshFacade();

    await expect(player.restoreSavedQueue()).resolves.toBe(true);

    expect(deletedPlaylistIds()).toEqual(["stale-1", "stale-2"]);
    const [created] = mockQueue.createPlaylist.mock.invocationCallOrder;
    for (const deleted of mockQueue.deletePlaylist.mock.invocationCallOrder) {
      expect(deleted).toBeLessThan(created);
    }
    expect(mockQueue.loadPlaylist).toHaveBeenCalledWith("playlist-1", 1);
  });

  it("deletes them when there is no queue to restore", async () => {
    mockQueue.getAllPlaylists.mockReturnValueOnce([enginePlaylist("stale-1")]);
    const player = await freshFacade();

    await expect(player.restoreSavedQueue()).resolves.toBe(false);

    expect(deletedPlaylistIds()).toEqual(["stale-1"]);
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

  // Records written before the ids were saved must still restore. Their
  // tracks report plays without a recording id rather than not playing.
  it("gives the restored cover the new session's token", async () => {
    mockStorage.getItem.mockResolvedValue(
      JSON.stringify({
        ...JSON.parse(savedRecord()),
        items: albumTracks.map((item) => ({
          id: item.id,
          artwork: album.artworkUrl,
          streamPath: item.streamPath,
          coverPath: "/api/library/albums/12/cover?v=abc",
        })),
      }),
    );
    const player = await freshFacade();

    await player.restoreSavedQueue();

    expect(queuedTracks()[0].artwork).toBe(
      "https://test.example/api/library/albums/12/cover?v=abc&token=restored-token",
    );
  });

  it("falls back to the album for a record saved without ids", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());
    const player = await freshFacade();

    await player.restoreSavedQueue();
    await flush();

    expect(lastSavedQueue().items).toContainEqual(
      expect.objectContaining({
        id: "72",
        trackMbid: null,
        artistMbid: "artist-mb-1",
        albumMbid: "album-mb-1",
        favorite: null,
      }),
    );
  });

  it("keeps a track's favorite, album page and quality through a restart", async () => {
    mockStorage.getItem.mockResolvedValue(
      JSON.stringify({
        ...JSON.parse(savedRecord()),
        items: albumTracks.map((item) => ({
          id: item.id,
          streamPath: item.streamPath,
          favorite: { kind: "flow-song", key: `flow-1:${item.id}` },
          albumRef: "canonical-album-12",
          audioFormat: "FLAC",
          bitrateKbps: 1042,
        })),
      }),
    );
    const player = await freshFacade();

    await player.restoreSavedQueue();
    await flush();

    expect(lastSavedQueue().items).toContainEqual(
      expect.objectContaining({
        id: "72",
        favorite: { kind: "flow-song", key: "flow-1:72" },
        albumRef: "canonical-album-12",
        audioFormat: "FLAC",
        bitrateKbps: 1042,
      }),
    );
  });

  it("reads a favorite from a queue saved with only the library identity key", async () => {
    mockStorage.getItem.mockResolvedValue(
      JSON.stringify({
        ...JSON.parse(savedRecord()),
        items: albumTracks.map((item) => ({
          id: item.id,
          streamPath: item.streamPath,
          identityKey: `recording:${item.id}`,
        })),
      }),
    );
    const player = await freshFacade();

    await player.restoreSavedQueue();
    await flush();

    expect(lastSavedQueue().items).toContainEqual(
      expect.objectContaining({
        id: "72",
        favorite: { kind: "song", key: "recording:72" },
      }),
    );
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

  it("offline, keeps the whole queue, plays saved tracks from their files, and moves on to one from a track that isn't saved", async () => {
    mockStorage.getItem.mockResolvedValue(savedRecord());
    mockFetch.mockRejectedValue(new Error("offline"));
    mockPhone.offline = true;
    mockPhone.saved.set("71", "/files/71.flac");
    mockPhone.saved.set("73", "/files/73.flac");
    const player = await freshFacade();

    try {
      await expect(player.restoreSavedQueue()).resolves.toBe(true);

      // The rest play again once the connection is back.
      expect(queuedTracks().map(({ id, url }) => [id, url])).toEqual([
        ["71", "/files/71.flac"],
        [
          "72",
          `${STREAM_ROOT}/library/canonical-stream/12/72?token=restored-token`,
        ],
        ["73", "/files/73.flac"],
      ]);
      // A saved track plays from the phone, so the server isn't asked.
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain("/72");

      // The restore left 72 paused. Play goes to the next saved track.
      expect(mockPlayer.playSong).not.toHaveBeenCalled();
      await player.resume();
      await flush();
      expect(mockPlayer.playSong).toHaveBeenCalledWith("73", "playlist-1");
      expect(mockPlayer.play).toHaveBeenCalled();
    } finally {
      mockPhone.offline = false;
      mockPhone.saved.clear();
    }
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
            coverPath: null,
          },
          {
            id: "71",
            title: "Everything In Its Right Place",
            artist: "Radiohead",
            album: "Kid A",
            artwork: null,
            streamPath: "/library/canonical-stream/12/71",
            coverPath: null,
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
    mockQueue.getAllPlaylists.mockReturnValue([enginePlaylist("playlist-1")]);

    await expect(player.restoreSavedQueue()).resolves.toBe(false);
    expect(mockQueue.createPlaylist).not.toHaveBeenCalled();
    expect(mockQueue.deletePlaylist).not.toHaveBeenCalled();
  });
});

describe("forgetting the queue", () => {
  it("stops the player and empties the queue", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);
    mockQueue.deletePlaylist.mockClear();
    mockQueue.getAllPlaylists.mockReturnValueOnce([
      enginePlaylist("playlist-1"),
      enginePlaylist("stale-1"),
    ]);

    await facade.forgetQueue();
    await flush();

    expect(mockPlayer.pause).toHaveBeenCalled();
    // Every playlist, not only the queue: the engine keeps earlier sessions'
    // playlists on disk.
    expect(deletedPlaylistIds()).toEqual(["playlist-1", "stale-1"]);
    expect(mockStorage.removeItem).toHaveBeenCalledWith(QUEUE_KEY);

    const { result } = await renderHook(() => facade.useHasQueue());
    expect(result.current).toBe(false);
  });

  it("forgets the queue even when the engine will not stop", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);
    mockPlayer.pause.mockClear();
    mockQueue.deletePlaylist.mockClear();
    mockPlayer.pause.mockRejectedValueOnce(new Error("engine"));
    mockQueue.getAllPlaylists.mockReturnValueOnce([
      enginePlaylist("playlist-1"),
    ]);

    await expect(facade.forgetQueue()).resolves.toBeUndefined();
    await flush();

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    // The token-bearing playlist still goes.
    expect(deletedPlaylistIds()).toEqual(["playlist-1"]);
    expect(mockStorage.removeItem).toHaveBeenCalledWith(QUEUE_KEY);
  });

  it("forgets the queue even when the playlist will not delete", async () => {
    await facade.playAlbumFromTrack(albumTracks, albumTracks[0], album);
    mockPlayer.pause.mockClear();
    mockQueue.deletePlaylist.mockClear();
    mockQueue.deletePlaylist.mockRejectedValueOnce(new Error("engine"));
    mockQueue.getAllPlaylists.mockReturnValueOnce([
      enginePlaylist("playlist-1"),
      enginePlaylist("stale-1"),
    ]);

    await expect(facade.forgetQueue()).resolves.toBeUndefined();
    await flush();

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    // One refusal does not keep the others.
    expect(deletedPlaylistIds()).toEqual(["playlist-1", "stale-1"]);
    expect(mockStorage.removeItem).toHaveBeenCalledWith(QUEUE_KEY);
  });

  it("deletes earlier sessions' playlists on a sign-out with nothing played", async () => {
    // A launch with no saved queue never starts the engine, so the playlists
    // it loaded from disk are still there, and the facade has no current one.
    mockQueue.getAllPlaylists.mockReturnValueOnce([enginePlaylist("stale-1")]);
    const player = await freshFacade();

    await player.forgetQueue();

    expect(deletedPlaylistIds()).toEqual(["stale-1"]);
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
