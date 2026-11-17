// Backed by maps, so the phone's name and the saved queue are read back.
const mockKeychain = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 6,
  getItemAsync: jest.fn((key: string) =>
    Promise.resolve(mockKeychain.get(key) ?? null),
  ),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockKeychain.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn(),
}));

const mockStore = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockStore.get(key) ?? null),
  ),
  setItem: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
}));

const mockFetch = jest.fn();
jest.mock("expo/fetch", () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

let mockOffline = false;
const mockNetworkListeners = new Set<(offline: boolean) => void>();
jest.mock("@/lib/offline/network", () => ({
  isOffline: () => mockOffline,
  isMetered: () => false,
  onMeteredChange: () => () => {},
  networkKnown: () => Promise.resolve(),
  onNetworkChange: (listener: (offline: boolean) => void) => {
    mockNetworkListeners.add(listener);
    return () => mockNetworkListeners.delete(listener);
  },
}));
jest.mock("@/lib/offline/saved-library", () => ({
  savedFilePath: () => null,
  savedLoudness: () => undefined,
  canPlayNow: () => true,
  savedLibraryReady: () => Promise.resolve(),
}));
jest.mock("@/lib/offline/audio-cache", () => ({
  cachedFilePath: () => null,
  cacheTranscodedTrack: () => Promise.resolve(null),
  cachedTranscode: () => undefined,
  cancelTranscodes: () => {},
  audioCacheReady: () => Promise.resolve(),
  markPlayed: () => {},
  setPrefetchWindow: () => {},
  onCachedFilesChange: () => () => {},
}));
jest.mock("@/lib/api/radio", () => ({
  getLibraryRadio: () => Promise.resolve([]),
}));

const mockGetPlayQueue = jest.fn();
const mockSavePlayQueue = jest.fn();
jest.mock("@/lib/api/play-queue", () => ({
  getPlayQueue: (...args: unknown[]) => mockGetPlayQueue(...args),
  savePlayQueue: (...args: unknown[]) => mockSavePlayQueue(...args),
}));

const mockLive = {
  messages: new Set<(message: unknown) => void>(),
  status: new Set<() => void>(),
  connected: false,
};
jest.mock("@/lib/api/live-socket", () => ({
  subscribeToLiveChannel: (
    _channel: string,
    _types: string[],
    listener: (message: unknown) => void,
  ) => {
    mockLive.messages.add(listener);
    return () => mockLive.messages.delete(listener);
  },
  subscribeToLiveStatus: (listener: () => void) => {
    mockLive.status.add(listener);
    return () => mockLive.status.delete(listener);
  },
  isLiveSocketConnected: () => mockLive.connected,
}));

import { act, renderHook } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { AppState, type AppStateStatus } from "react-native";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import type { PlayQueue, PlayQueueTrack } from "@/lib/api/play-queue";
import {
  DEFAULT_PLAYBACK_SETTINGS,
  setPlaybackSettings,
} from "@/lib/player/playback-settings";
import {
  forgetQueue,
  onTrackStarted,
  playAlbumFromTrack,
  playItem,
  restoreSavedQueue,
  seekTo,
} from "@/lib/player/player";
import {
  pickUpQueue,
  startQueueSync,
  useOtherDevice,
} from "@/lib/player/queue-sync";
import { saveQueue } from "@/lib/player/saved-queue";
import type { Track } from "@/lib/types/library";
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const manager = callbackManager as jest.Mocked<typeof callbackManager>;

const THIS_PHONE = "Aurral Pocket on iPhone 0a1b";
const WEB = "Aurral web 1a2b3c4d";

const album = {
  albumTitle: "OK Computer",
  artistName: "Radiohead",
  coverPath: null,
  artworkUrl: null,
  albumMbid: "mb-ok-computer",
  artistMbid: "mb-radiohead",
};

function track(id: string): Track {
  return {
    id,
    mbid: `mb-${id}`,
    trackName: `Track ${id}`,
    title: `Track ${id}`,
    trackNumber: Number(id),
    hasFile: true,
    size: 9_000_000,
    quality: "FLAC",
    streamPath: `/library/stream/12/${id}`,
    streamFormat: "flac",
    available: true,
  };
}

const okComputer = [track("71"), track("72"), track("73")];

/** A track as GET /play-queue sends it. */
function remoteTrack(id: string): PlayQueueTrack {
  return {
    id,
    title: `Dummy ${id}`,
    artist: "Portishead",
    album: "Dummy",
    streamPath: `/library/stream/30/${id}`,
    streamFormat: "flac",
    quality: "FLAC",
    durationMs: 240_000,
    artistMbid: "mb-portishead",
    albumMbid: "mb-dummy",
    trackMbid: null,
    libraryTrackId: Number(id),
    libraryAlbumId: 30,
    libraryArtistId: 5,
    artworkUrl: "/library/artwork/30",
    artworkSource: "album",
  };
}

/** The web paused on the second of three tracks, at 2:14. */
function webQueue(changed = 5_000): PlayQueue {
  return {
    changed,
    changedBy: WEB,
    tracks: [remoteTrack("81"), remoteTrack("82"), remoteTrack("83")],
    currentIndex: 1,
    positionMs: 134_000,
  };
}

function webSaved(changed: number, changedBy = WEB): void {
  mockLive.messages.forEach((listener) =>
    listener({
      type: "play_queue_changed",
      channel: "play-queue",
      changed,
      changedBy,
      timestamp: changed,
    }),
  );
}

/** Lets storage reads, the server's answer and the player's chain land. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

let engine: {
  trackChange: Parameters<typeof manager.subscribeToTrackChange>[0];
  stateChange: Parameters<typeof manager.subscribeToPlaybackState>[0];
  progress: Parameters<typeof manager.subscribeToPlaybackProgressChange>[0];
};
let enginePlaylist: string[] = [];
const appStateListeners = new Set<(state: AppStateStatus) => void>();
let stopSync: () => void = () => {};
let now = 1_000_000;
const spies: jest.SpyInstance[] = [];

function startSync(): void {
  stopSync = startQueueSync();
}

function moveTo(id: string): void {
  engine.trackChange({
    id,
    title: "",
    artist: "",
    album: "",
    duration: 0,
    url: "",
  });
}

beforeAll(() => {
  onTrackStarted(() => {})();
  engine = {
    trackChange: manager.subscribeToTrackChange.mock.calls[0][0],
    stateChange: manager.subscribeToPlaybackState.mock.calls[0][0],
    progress: manager.subscribeToPlaybackProgressChange.mock.calls[0][0],
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  mockKeychain.clear();
  mockKeychain.set("player_device", THIS_PHONE);
  mockOffline = false;
  mockLive.connected = false;
  setBaseUrl("https://test.example");
  setAuthToken("test-token-123");
  mockFetch.mockResolvedValue({ status: 206 });
  mockGetPlayQueue.mockResolvedValue(null);
  mockSavePlayQueue.mockResolvedValue(1_000);
  now = 1_000_000;
  spies.push(
    jest.spyOn(Date, "now").mockImplementation(() => now),
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        appStateListeners.add(listener);
        return { remove: () => appStateListeners.delete(listener) };
      }),
  );
  enginePlaylist = [];
  queue.createPlaylist.mockImplementation(() => {
    enginePlaylist = [];
    return Promise.resolve("playlist-1");
  });
  queue.addTracksToPlaylist.mockImplementation((_, tracks) => {
    enginePlaylist.push(...tracks.map((t) => t.id));
    return Promise.resolve();
  });
});

afterEach(async () => {
  // Stopping clears an offer a mounted hook still shows.
  await act(async () => {
    stopSync();
    await forgetQueue();
  });
  engine.stateChange("stopped", undefined);
  setPlaybackSettings(DEFAULT_PLAYBACK_SETTINGS);
  spies.splice(0).forEach((spy) => spy.mockRestore());
});

describe("saving the queue to Aurral", () => {
  it("sends a new play at once, under a name the phone keeps", async () => {
    mockKeychain.delete("player_device");
    startSync();
    await playAlbumFromTrack(okComputer, okComputer[1], album);
    await settle();

    expect(mockSavePlayQueue).toHaveBeenCalledWith({
      streamPaths: [
        "/library/stream/12/71",
        "/library/stream/12/72",
        "/library/stream/12/73",
      ],
      current: 1,
      positionMs: 0,
      device: expect.stringMatching(/^Aurral Pocket on .+ [0-9a-f]{4}$/),
    });
    const { device } = mockSavePlayQueue.mock.calls[0][0];
    // A backup restored onto a new phone must not bring the name with it.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "player_device",
      device,
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
    );

    // A new name after a restart would read as another device, and the phone
    // would be offered its own queue.
    stopSync();
    startSync();
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    await settle();
    expect(mockSavePlayQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ device, current: 0 }),
    );
  });

  it("sends a playing queue's position every 30 seconds, and a pause at once", async () => {
    startSync();
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    moveTo("71");
    engine.stateChange("playing", undefined);
    await settle();
    mockSavePlayQueue.mockClear();

    now += 10_000;
    engine.progress(10, 240, false);
    await settle();
    expect(mockSavePlayQueue).not.toHaveBeenCalled();

    now += 21_000;
    engine.progress(31, 240, false);
    engine.progress(33, 240, false);
    engine.stateChange("paused", undefined);
    await settle();

    expect(
      mockSavePlayQueue.mock.calls.map(([save]) => save.positionMs),
    ).toEqual([31_000, 33_000]);
  });

  it("sends the 20 tracks before the current one and 200 in all", async () => {
    const long = Array.from({ length: 500 }, (_, i) => track(String(i + 1)));
    startSync();
    await playAlbumFromTrack(long, long[99], album);
    await settle();

    const [save] = mockSavePlayQueue.mock.calls[0];
    expect(save.streamPaths).toHaveLength(200);
    expect(save.streamPaths[0]).toBe("/library/stream/12/80");
    expect(save.streamPaths[save.current]).toBe("/library/stream/12/100");
  });

  it("leaves Aurral's copy alone when the saved queue comes back at launch", async () => {
    await saveQueue({
      items: okComputer.map((t) => ({
        id: t.id,
        title: t.title,
        artist: "Radiohead",
        album: "OK Computer",
        artwork: null,
        streamPath: t.streamPath!,
      })),
      originalIds: ["71", "72", "73"],
      currentId: "72",
      positionSeconds: 61,
      durationSeconds: 240,
      album,
      shuffle: false,
      repeat: "off",
    });

    // As the app's layout does: the restore is still probing its tracks when
    // the sync starts.
    const restored = restoreSavedQueue();
    startSync();
    await restored;
    await settle();

    expect(enginePlaylist).toEqual(["71", "72", "73"]);
    expect(mockSavePlayQueue).not.toHaveBeenCalled();
  });

  it("sends a change made offline once Aurral is back", async () => {
    startSync();
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    await settle();
    mockSavePlayQueue.mockClear();

    mockOffline = true;
    await seekTo(95);
    await settle();
    expect(mockSavePlayQueue).not.toHaveBeenCalled();

    mockOffline = false;
    mockGetPlayQueue.mockResolvedValue({
      ...webQueue(1_000),
      changedBy: THIS_PHONE,
    });
    mockNetworkListeners.forEach((listener) => listener(false));
    await settle();

    expect(mockSavePlayQueue).toHaveBeenCalledWith(
      expect.objectContaining({ current: 0, positionMs: 95_000 }),
    );
  });

  it("lists the newer queue instead when another device saved while offline", async () => {
    startSync();
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    await settle();
    mockSavePlayQueue.mockClear();
    mockOffline = true;
    await seekTo(95);
    await settle();
    const { result } = await renderHook(() => useOtherDevice());

    mockOffline = false;
    mockGetPlayQueue.mockResolvedValue(webQueue(9_000));
    mockLive.connected = true;
    await act(async () => {
      mockLive.status.forEach((listener) => listener());
      await settle();
    });

    expect(mockSavePlayQueue).not.toHaveBeenCalled();
    expect(result.current?.name).toBe("Aurral web");
  });
});

describe("picking up another device's queue", () => {
  it("loads it paused where that device left off when nothing is queued", async () => {
    mockGetPlayQueue.mockResolvedValue(webQueue());
    startSync();
    await settle();

    expect(enginePlaylist).toEqual(["81", "82", "83"]);
    expect(queue.loadPlaylist).toHaveBeenLastCalledWith("playlist-1", 1);
    expect(player.seek).toHaveBeenLastCalledWith(134);
    expect(player.play).not.toHaveBeenCalled();
    // Taking the queue isn't news to send back.
    expect(mockSavePlayQueue).not.toHaveBeenCalled();
  });

  it("lists it beside a paused queue, and plays it from there on pick-up", async () => {
    startSync();
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    engine.stateChange("paused", undefined);
    await settle();
    const { result } = await renderHook(() => useOtherDevice());

    mockGetPlayQueue.mockResolvedValue(webQueue());
    await act(async () => {
      webSaved(5_000);
      await settle();
    });

    expect(result.current).toEqual(
      expect.objectContaining({
        name: "Aurral web",
        positionSeconds: 134,
        savedAt: 5_000,
        track: expect.objectContaining({ title: "Dummy 82" }),
      }),
    );
    expect(enginePlaylist).toEqual(["71", "72", "73"]);

    await act(async () => {
      await pickUpQueue();
    });

    expect(result.current).toBeNull();
    expect(enginePlaylist).toEqual(["81", "82", "83"]);
    expect(queue.loadPlaylist).toHaveBeenLastCalledWith("playlist-1", 1);
    expect(player.seek).toHaveBeenLastCalledWith(134);
    expect(player.play).toHaveBeenCalled();
  });

  it("lists it without replacing a queue that's playing", async () => {
    startSync();
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    engine.stateChange("playing", undefined);
    await settle();
    const { result } = await renderHook(() => useOtherDevice());

    mockGetPlayQueue.mockResolvedValue(webQueue());
    await act(async () => {
      webSaved(5_000);
      await settle();
    });

    expect(result.current?.name).toBe("Aurral web");
    expect(enginePlaylist).toEqual(["71", "72", "73"]);
  });

  it("drops it once this phone saves over it", async () => {
    startSync();
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    moveTo("71");
    engine.stateChange("paused", undefined);
    await settle();
    const { result } = await renderHook(() => useOtherDevice());
    mockGetPlayQueue.mockResolvedValue(webQueue(5_000));
    await act(async () => {
      webSaved(5_000);
      await settle();
    });
    expect(result.current?.name).toBe("Aurral web");

    // The listener carries on with the queue here instead.
    mockSavePlayQueue.mockResolvedValue(9_000);
    await act(async () => {
      await seekTo(40);
      await settle();
    });

    expect(result.current).toBeNull();
  });

  it("looks again when the app comes back to the foreground", async () => {
    startSync();
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    engine.stateChange("paused", undefined);
    await settle();
    const { result } = await renderHook(() => useOtherDevice());

    // Saved while the app was away, with the socket closed.
    mockGetPlayQueue.mockResolvedValue(webQueue());
    await act(async () => {
      appStateListeners.forEach((listener) => listener("background"));
      appStateListeners.forEach((listener) => listener("active"));
      await settle();
    });

    expect(result.current?.name).toBe("Aurral web");
  });

  it("starts a track queued twice at its own place", async () => {
    mockGetPlayQueue.mockResolvedValue({
      ...webQueue(),
      tracks: ["81", "82", "83", "81"].map(remoteTrack),
      currentIndex: 3,
    });
    startSync();
    await settle();

    expect(enginePlaylist).toEqual(["82", "83", "81"]);
    expect(queue.loadPlaylist).toHaveBeenLastCalledWith("playlist-1", 2);
  });

  it("leaves a play started while Aurral answers in place", async () => {
    let answer!: (queue: PlayQueue) => void;
    mockGetPlayQueue.mockReturnValue(
      new Promise<PlayQueue>((resolve) => {
        answer = resolve;
      }),
    );
    startSync();
    await settle();

    // Tapped before the engine says it's playing.
    await playItem({
      id: "preview-9",
      title: "Idioteque",
      artist: "Radiohead",
      album: "Kid A",
      duration: 0,
      url: "https://preview.example/9.mp3",
      artwork: null,
    });
    await act(async () => {
      answer(webQueue());
      await settle();
    });

    expect(enginePlaylist).toEqual(["preview-9"]);
  });

  it("keeps it listed when its queue fails to load", async () => {
    startSync();
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    engine.stateChange("paused", undefined);
    await settle();
    const { result } = await renderHook(() => useOtherDevice());
    mockGetPlayQueue.mockResolvedValue(webQueue());
    await act(async () => {
      webSaved(5_000);
      await settle();
    });

    queue.loadPlaylist.mockRejectedValueOnce(new Error("engine"));
    await act(async () => {
      await expect(pickUpQueue()).rejects.toThrow("engine");
    });

    expect(result.current?.name).toBe("Aurral web");
  });

  it("never takes back the queue this phone saved, as after a sign-out", async () => {
    mockGetPlayQueue.mockResolvedValue({
      ...webQueue(),
      changedBy: THIS_PHONE,
    });
    startSync();
    await settle();
    expect(queue.createPlaylist).not.toHaveBeenCalled();

    mockGetPlayQueue.mockClear();
    webSaved(6_000, THIS_PHONE);
    await settle();
    expect(mockGetPlayQueue).not.toHaveBeenCalled();
  });
});
