// The facade registers its engine callbacks once per module, so the car's
// hand-off gets a module of its own here.
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

jest.mock("@/lib/offline/network", () => ({
  isOffline: () => false,
  isMetered: () => false,
  onMeteredChange: () => () => {},
  networkKnown: () => Promise.resolve(),
  onNetworkChange: () => () => {},
}));

import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import {
  forgetQueue,
  onTrackStarted,
  playQueueFrom,
  preparePlayer,
  restoreSavedQueue,
  shelveForCar,
} from "@/lib/player/player";
import type { PlayerTrack } from "@/lib/player/track-item";
import {
  PlayerQueue,
  TrackPlayer,
  type TrackItem,
} from "react-native-nitro-player";
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const manager = callbackManager as jest.Mocked<typeof callbackManager>;

function song(id: string): PlayerTrack {
  return {
    id,
    title: `Song ${id}`,
    artist: "Radiohead",
    album: "Kid A",
    duration: 0,
    url: `https://test.example/library/stream/12/${id}?token=t`,
    artwork: null,
    streamPath: `/library/stream/12/${id}`,
    coverPath: null,
    trackMbid: null,
    artistMbid: null,
    albumMbid: null,
    favorite: null,
  };
}

/** The engine's ask for the URLs of the tracks it's about to play. */
let needUrls: (tracks: TrackItem[], lookahead: number) => void;

beforeAll(() => {
  player.onTracksNeedUpdate.mockImplementation((callback) => {
    needUrls = callback;
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  setBaseUrl("https://test.example");
  setAuthToken("t");
  queue.createPlaylist.mockResolvedValue("shelf-1");
  queue.getAllPlaylists.mockReturnValue([]);
});

afterEach(async () => {
  await forgetQueue();
});

/** Shelve the songs and return the tracks the engine was given. */
async function shelve(
  songs: PlayerTrack[],
  play: (trackId: string) => Promise<boolean> = jest.fn(async () => true),
) {
  queue.addTracksToPlaylist.mockClear();
  const mediaIds = await shelveForCar(songs, play);
  const [, tracks] = queue.addTracksToPlaylist.mock.calls[0];
  return { mediaIds, tracks };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("shelveForCar", () => {
  it("gives the engine no URL, so a song plays only once it's picked", async () => {
    const { mediaIds, tracks } = await shelve([song("71"), song("72")]);

    expect(tracks).toEqual([
      expect.objectContaining({ title: "Song 71", url: "" }),
      expect.objectContaining({ title: "Song 72", url: "" }),
    ]);
    // Android Auto picks a song by playlist and track, as the engine lists
    // them.
    expect(mediaIds).toEqual(tracks.map(({ id }) => `shelf-1:${id}`));
  });

  it("hands a song picked in the car to the queue", async () => {
    const play = jest.fn(() => Promise.resolve(true));
    const { tracks } = await shelve([song("71"), song("72")], play);

    needUrls([tracks[1]], 0);

    expect(play).toHaveBeenCalledWith("72");
    expect(player.updateTracks).not.toHaveBeenCalled();
  });

  it("leaves the queue's song on screen while a pick is handed off", async () => {
    const started = jest.fn();
    const unsubscribe = onTrackStarted(started);
    const trackChange = manager.subscribeToTrackChange.mock.calls[0][0];
    const { tracks } = await shelve([song("71")]);

    trackChange(tracks[0]);

    expect(started).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("survives a restore, which deletes every other playlist", async () => {
    await shelve([song("71")]);
    queue.getAllPlaylists.mockReturnValue([
      { id: "shelf-1" },
      { id: "leftover" },
    ] as ReturnType<typeof PlayerQueue.getAllPlaylists>);

    await restoreSavedQueue();

    expect(queue.deletePlaylist).toHaveBeenCalledWith("leftover");
    expect(queue.deletePlaylist).not.toHaveBeenCalledWith("shelf-1");
  });

  it("goes with the account's other playlists on sign-out", async () => {
    await shelve([song("71")]);
    queue.getAllPlaylists.mockReturnValue([{ id: "shelf-1" }] as ReturnType<
      typeof PlayerQueue.getAllPlaylists
    >);

    await forgetQueue();

    expect(queue.deletePlaylist).toHaveBeenCalledWith("shelf-1");
  });

  describe("when a pick doesn't start", () => {
    beforeEach(async () => {
      queue.createPlaylist.mockResolvedValueOnce("queue-1");
      await playQueueFrom([song("q1"), song("q2")], "q2", {
        albumTitle: "Amnesiac",
        artistName: "Radiohead",
        coverPath: null,
        artworkUrl: null,
        albumMbid: null,
        artistMbid: null,
      });
      queue.loadPlaylist.mockClear();
    });

    it("puts the engine back on the queue when the song can't play", async () => {
      const { tracks } = await shelve([song("71")], async () => false);

      needUrls([tracks[0]], 0);
      await flush();

      // Ready where the queue was, not left waiting on the shelf's song.
      expect(queue.loadPlaylist).toHaveBeenCalledWith("queue-1", 1);
    });

    it("plays nothing from an earlier run's shelf of the same number", async () => {
      const play = jest.fn(async () => true);
      const { tracks } = await shelve([song("71")], play);
      const earlier = tracks[0].id.replace(/^car-[a-z0-9]+-/, "car-earlier-");

      needUrls([{ ...tracks[0], id: earlier }], 0);
      await flush();

      expect(play).not.toHaveBeenCalled();
      expect(queue.loadPlaylist).toHaveBeenCalledWith("queue-1", 1);
    });
  });
});

describe("preparePlayer", () => {
  it("clears an earlier run's playlists before the car can find them", async () => {
    queue.getAllPlaylists.mockReturnValue([{ id: "earlier" }] as ReturnType<
      typeof PlayerQueue.getAllPlaylists
    >);

    await preparePlayer();

    expect(queue.deletePlaylist).toHaveBeenCalledWith("earlier");
  });
});
