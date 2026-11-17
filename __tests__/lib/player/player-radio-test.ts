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

let mockOffline = false;
jest.mock("@/lib/offline/saved-library", () => ({
  savedFilePath: () => null,
  savedLoudness: () => undefined,
  canPlayNow: () => !mockOffline,
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
jest.mock("@/lib/offline/network", () => ({
  isOffline: () => mockOffline,
  isMetered: () => false,
  onMeteredChange: () => () => {},
  networkKnown: () => Promise.resolve(),
  onNetworkChange: () => () => {},
}));

const mockGetLibraryRadio = jest.fn();
jest.mock("@/lib/api/radio", () => ({
  getLibraryRadio: (...args: unknown[]) => mockGetLibraryRadio(...args),
}));

import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import {
  addToQueue,
  forgetQueue,
  onTrackStarted,
  playAlbumFromTrack,
  setRepeatMode,
  setShuffle,
  startRadio,
} from "@/lib/player/player";
import {
  DEFAULT_PLAYBACK_SETTINGS,
  setPlaybackSettings,
} from "@/lib/player/playback-settings";
import { toPlayerTrack } from "@/lib/player/track-item";
import type { LibraryQueueTrack, Track } from "@/lib/types/library";
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const manager = callbackManager as jest.Mocked<typeof callbackManager>;

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

/** A track as POST /library/radio sends it. */
function stationTrack(id: string): LibraryQueueTrack {
  return {
    id,
    title: `Station ${id}`,
    artist: "Portishead",
    album: "Dummy",
    streamPath: `/library/stream/30/${id}`,
    streamFormat: "flac",
    quality: "FLAC",
    durationMs: 200_000,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Lets Aurral's answer and the queue edit chained on it land. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

const okComputer = [track("71"), track("72"), track("73")];
const otherAlbum = [track("61"), track("62")];

// The facade wires itself into the callback manager on its first
// subscription; capturing what it registered lets the tests play the engine.
let engine: {
  trackChange: Parameters<typeof manager.subscribeToTrackChange>[0];
  stateChange: Parameters<typeof manager.subscribeToPlaybackState>[0];
};
// A stateful stand-in for the engine playlist, so the tests read the order
// the queue ends up in.
let playlistIds: string[] = [];

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
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  setBaseUrl("https://test.example");
  setAuthToken("test-token-123");
  playlistIds = [];
  queue.createPlaylist.mockImplementation(() => {
    playlistIds = [];
    return Promise.resolve("playlist-1");
  });
  queue.addTracksToPlaylist.mockImplementation((_, tracks, index) => {
    playlistIds.splice(
      index ?? playlistIds.length,
      0,
      ...tracks.map((t) => t.id),
    );
    return Promise.resolve();
  });
  queue.removeTracksFromPlaylist.mockImplementation((_, ids) => {
    playlistIds = playlistIds.filter((id) => !ids.includes(id));
    return Promise.resolve();
  });
  mockGetLibraryRadio.mockResolvedValue([]);
});

afterEach(() => {
  setPlaybackSettings(DEFAULT_PLAYBACK_SETTINGS);
});

describe("starting radio", () => {
  it("plays a track at once, then queues its station behind it", async () => {
    const airbag = toPlayerTrack(track("77"), album)!;
    const seed = { trackIds: ["77"], artists: [] };
    const answer = deferred<LibraryQueueTrack[]>();
    mockGetLibraryRadio.mockReturnValue(answer.promise);

    const radio = startRadio({ seed, label: "Airbag" }, airbag);
    await settle();
    // The engine's play event doesn't ask again while the first batch loads.
    engine.stateChange("playing", undefined);

    expect(playlistIds).toEqual(["77"]);
    expect(player.play).toHaveBeenCalled();
    expect(mockGetLibraryRadio).toHaveBeenCalledTimes(1);
    expect(mockGetLibraryRadio).toHaveBeenCalledWith(seed, ["77"]);
    answer.resolve([
      stationTrack("81"),
      stationTrack("82"),
      stationTrack("83"),
    ]);
    await expect(radio).resolves.toBe("started");
    expect(playlistIds).toEqual(["77", "81", "82", "83"]);
  });

  it("says a track's station came back empty, with the track still playing", async () => {
    const airbag = toPlayerTrack(track("77"), album)!;

    await expect(
      startRadio({ seed: { trackIds: ["77"] }, label: "Airbag" }, airbag),
    ).resolves.toBe("empty");

    expect(playlistIds).toEqual(["77"]);
  });

  it("replaces the queue with an album's station once Aurral answers", async () => {
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    const seed = { albumIds: ["12"] };
    mockGetLibraryRadio.mockResolvedValue([
      stationTrack("81"),
      stationTrack("82"),
      stationTrack("83"),
    ]);

    await expect(startRadio({ seed, label: "OK Computer" })).resolves.toBe(
      "started",
    );

    expect(mockGetLibraryRadio).toHaveBeenCalledWith(seed);
    expect(playlistIds).toEqual(["81", "82", "83"]);
    expect(queue.loadPlaylist).toHaveBeenLastCalledWith("playlist-1", 0);
  });

  it.each([
    { result: "offline", offline: true, asked: false },
    { result: "empty", offline: false, asked: true },
  ])(
    "leaves the queue playing when it comes back $result",
    async ({ result, offline, asked }) => {
      await playAlbumFromTrack(okComputer, okComputer[0], album);
      mockOffline = offline;

      await expect(
        startRadio({ seed: { albumIds: ["12"] }, label: "OK Computer" }),
      ).resolves.toBe(result);

      expect(mockGetLibraryRadio).toHaveBeenCalledTimes(asked ? 1 : 0);
      expect(playlistIds).toEqual(["71", "72", "73"]);
    },
  );

  it.each([
    {
      action: "a play tapped",
      play: () => playAlbumFromTrack(otherAlbum, otherAlbum[0], album),
    },
    {
      action: "songs added to the empty queue",
      play: () => addToQueue(otherAlbum, album),
    },
  ])("gives way to $action while the station loads", async ({ play }) => {
    await forgetQueue();
    const answer = deferred<LibraryQueueTrack[]>();
    mockGetLibraryRadio.mockReturnValue(answer.promise);

    const radio = startRadio({ seed: { albumIds: ["12"] }, label: "Dummy" });
    await play();
    answer.resolve([stationTrack("81")]);
    await radio;

    expect(playlistIds).toEqual(["61", "62"]);
  });
});

describe("a station", () => {
  it("asks for more with two tracks left, leaving out the ones it has", async () => {
    const station = { seed: { artists: [{ id: "5" }] }, label: "Portishead" };
    mockGetLibraryRadio.mockResolvedValueOnce(
      ["81", "82", "83", "84"].map(stationTrack),
    );
    await startRadio(station);
    mockGetLibraryRadio.mockResolvedValueOnce([stationTrack("85")]);
    engine.stateChange("playing", undefined);
    expect(mockGetLibraryRadio).toHaveBeenCalledTimes(1);

    moveTo("82");
    await settle();

    expect(mockGetLibraryRadio).toHaveBeenLastCalledWith(station.seed, [
      "81",
      "82",
      "83",
      "84",
    ]);
    expect(playlistIds).toEqual(["81", "82", "83", "84", "85"]);
  });
});

describe("Autoplay", () => {
  /** OK Computer playing, on its last track, with Autoplay's batch queued. */
  async function autoplayAfterOkComputer(): Promise<void> {
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    engine.stateChange("playing", undefined);
    mockGetLibraryRadio.mockResolvedValue([
      stationTrack("91"),
      stationTrack("92"),
    ]);
    moveTo("72");
    moveTo("73");
    await settle();
  }

  it("waits for the queue's last track, then follows it with music like the last ones played", async () => {
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    engine.stateChange("playing", undefined);
    mockGetLibraryRadio.mockResolvedValue([stationTrack("91")]);

    moveTo("72");
    await settle();
    expect(mockGetLibraryRadio).not.toHaveBeenCalled();

    moveTo("73");
    await settle();

    expect(mockGetLibraryRadio).toHaveBeenCalledWith(
      { trackIds: ["73", "72", "71"], artists: [] },
      ["71", "72", "73"],
    );
    expect(playlistIds).toEqual(["71", "72", "73", "91"]);
  });

  it("lets the queue end when it's off", async () => {
    setPlaybackSettings({ autoplay: false });
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    engine.stateChange("playing", undefined);

    moveTo("73");
    await settle();

    expect(mockGetLibraryRadio).not.toHaveBeenCalled();
    expect(playlistIds).toEqual(["71", "72", "73"]);
  });

  it("plays the listener's added tracks before its own", async () => {
    await autoplayAfterOkComputer();

    await addToQueue(otherAlbum, album);

    expect(playlistIds).toEqual(["71", "72", "73", "61", "62", "91", "92"]);
  });

  it("takes back the tracks it queued when turned off, and asks again when turned on", async () => {
    await autoplayAfterOkComputer();

    setPlaybackSettings({ autoplay: false });
    await settle();

    expect(queue.removeTracksFromPlaylist).toHaveBeenCalledWith("playlist-1", [
      "91",
      "92",
    ]);
    expect(playlistIds).toEqual(["71", "72", "73"]);

    setPlaybackSettings({ autoplay: true });
    await settle();

    expect(playlistIds).toEqual(["71", "72", "73", "91", "92"]);
  });

  it("keeps its tracks after the listener's own when shuffled", async () => {
    await autoplayAfterOkComputer();
    await addToQueue(otherAlbum, album);

    await setShuffle(true);

    try {
      expect(playlistIds.slice(5)).toEqual(["91", "92"]);
    } finally {
      await setShuffle(false);
    }
  });

  it("asks again at the next resume after a failed request", async () => {
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    engine.stateChange("playing", undefined);
    mockGetLibraryRadio.mockRejectedValueOnce(new Error("offline"));
    moveTo("73");
    await settle();
    mockGetLibraryRadio.mockResolvedValue([stationTrack("91")]);

    engine.stateChange("paused", undefined);
    engine.stateChange("playing", undefined);
    await settle();

    expect(mockGetLibraryRadio).toHaveBeenCalledTimes(2);
    expect(playlistIds).toEqual(["71", "72", "73", "91"]);
  });

  it("waits out repeat, and asks once it's turned off", async () => {
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    await setRepeatMode("all");
    engine.stateChange("playing", undefined);
    mockGetLibraryRadio.mockResolvedValue([stationTrack("91")]);
    moveTo("73");
    await settle();
    expect(mockGetLibraryRadio).not.toHaveBeenCalled();

    await setRepeatMode("off");
    await settle();

    expect(playlistIds).toEqual(["71", "72", "73", "91"]);
  });

  it("carries on into its tracks when the queue ended while Aurral answered", async () => {
    await playAlbumFromTrack(okComputer, okComputer[0], album);
    engine.stateChange("playing", undefined);
    const answer = deferred<LibraryQueueTrack[]>();
    mockGetLibraryRadio.mockReturnValue(answer.promise);
    moveTo("73");

    engine.stateChange("stopped", "end");
    answer.resolve([stationTrack("91")]);
    await settle();

    expect(player.playSong).toHaveBeenCalledWith("91", "playlist-1");
    expect(player.play).toHaveBeenCalled();
  });
});
