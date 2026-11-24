import type * as Testing from "@testing-library/react-native/pure";
import type * as SavedLibrary from "@/lib/offline/saved-library";
import type * as FakeFileSystem from "@/test-support/expo-file-system";
import type { PlayerTrack } from "@/lib/player/track-item";
import type { FlowJob, SharedPlaylist } from "@/lib/types/flow";
import type { Track } from "@/lib/types/library";

// The saved library and the fake disk both keep module state. Each test loads
// fresh copies, as a cold start would, after seeding what a restart finds.
let lib: typeof SavedLibrary;
// Loaded with the store, so its hooks and the renderer share one React.
let renderHook: typeof Testing.renderHook;
let act: typeof Testing.act;
let cleanup: typeof Testing.cleanup | null = null;

afterEach(async () => {
  await cleanup?.();
});
let fs: typeof FakeFileSystem;
let storage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};
let network: {
  getNetworkStateAsync: jest.Mock;
  addNetworkStateListener: jest.Mock;
};

const SERVER = "https://music.example";
const DIRECTORY = "file:///documents/saved-offline";

function start({
  record,
  files = {},
  offline = false,
  metered = false,
}: {
  record?: unknown;
  files?: Record<string, number>;
  offline?: boolean;
  /** On cellular data. */
  metered?: boolean;
} = {}) {
  jest.resetModules();

  storage = require("@react-native-async-storage/async-storage");
  network = require("expo-network");
  fs = require("@/test-support/expo-file-system");
  const client = require("@/lib/api/client");
  // The pure entry registers no hooks of its own, so it can load mid-test.
  ({
    renderHook,
    act,
    cleanup,
  } = require("@testing-library/react-native/pure"));

  client.setBaseUrl(SERVER);
  client.setAuthToken("token-1");
  client.setCustomHeaders({ "CF-Access-Client-Id": "proxy-id" });
  if (record) void storage.setItem("saved_offline", JSON.stringify(record));
  for (const [name, bytes] of Object.entries(files)) {
    fs.writeFakeFile(`${DIRECTORY}/${name}`, bytes);
  }
  network.getNetworkStateAsync.mockResolvedValue({
    isConnected: !offline,
    isInternetReachable: !offline,
    isMetered: metered,
  });

  lib = require("@/lib/offline/saved-library");
  return client;
}

/** Lets the store's storage reads, writes and download hand-offs land. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function track(id: string, overrides: Partial<Track> = {}): Track {
  return {
    id,
    mbid: `mb-${id}`,
    trackName: `Track ${id}`,
    title: `Track ${id}`,
    trackNumber: Number(id) % 10,
    hasFile: true,
    size: 1_000,
    quality: "FLAC",
    streamPath: `/library/stream/12/${id}`,
    streamFormat: "flac",
    ...overrides,
  };
}

const route = {
  title: "Kid A",
  artistName: "Radiohead",
  artistMbid: "artist-mb",
  albumMbid: "album-mb",
  coverUrl: "",
  libraryAlbumId: "12",
  artistId: "",
};

async function saveAndFinish(ref: string, tracks: Track[]) {
  lib.saveAlbum({ ref, route, tracks });
  await settle();
  // One file at a time: each finish starts the next.
  while (fs.downloads.some((download) => !download.cancelled)) {
    const pending = fs.downloads.splice(0);
    pending.forEach((download) => download.finish(1_000));
    await settle();
  }
}

describe("saving an album", () => {
  it("downloads its tracks one at a time with the session's URL and the proxy headers, then plays them from the phone", async () => {
    start();
    lib.setSavedLibraryUser(1);
    lib.saveAlbum({
      ref: "12",
      route,
      tracks: [
        track("71"),
        track("72", { streamFormat: "mp3", size: 2_000 }),
        track("73", { streamPath: null }),
      ],
    });
    await settle();

    expect(fs.downloads).toHaveLength(1);
    expect(fs.downloads[0]).toMatchObject({
      url: `${SERVER}/api/library/stream/12/71?token=token-1`,
      destination: `${DIRECTORY}/71.flac`,
      headers: { "CF-Access-Client-Id": "proxy-id" },
    });
    expect(lib.savedFilePath("71")).toBeNull();

    fs.downloads[0].finish(1_000);
    await settle();
    expect(lib.savedFilePath("71")).toBe("/documents/saved-offline/71.flac");
    // The extension follows the file's format, which iOS needs to play it.
    expect(fs.downloads[1].destination).toBe(`${DIRECTORY}/72.mp3`);

    fs.downloads[1].finish(2_000);
    await settle();
    expect(lib.savedFilePath("72")).toBe("/documents/saved-offline/72.mp3");
    // A track with no file on the server is never asked for.
    expect(fs.downloads).toHaveLength(2);
  });

  it("writes no session token to the phone", async () => {
    start();
    lib.setSavedLibraryUser(1);
    await saveAndFinish("12", [track("71"), track("72")]);

    const record = await storage.getItem("saved_offline");
    expect(record).toContain("/library/stream/12/71");
    expect(record).not.toContain("token-1");
  });
});

describe("accounts", () => {
  it("keeps one account's saves from another, and gives them back when it returns", async () => {
    start();
    lib.setSavedLibraryUser(1);
    await saveAndFinish("12", [track("71")]);

    lib.setSavedLibraryUser(2);
    await settle();
    const { result } = await renderHook(() => lib.useSavedItems());
    expect(result.current).toEqual([]);
    expect(lib.savedFilePath("71")).toBeNull();

    // Signed out: nothing shows, and nothing is deleted.
    await act(async () => {
      lib.setSavedLibraryUser(null);
      await settle();
    });
    expect(fs.fakeFileExists(`${DIRECTORY}/71.flac`)).toBe(true);

    await act(async () => {
      lib.setSavedLibraryUser(1);
      await settle();
    });
    expect(result.current.map((save) => save.item.id)).toEqual(["12"]);
    expect(lib.savedFilePath("71")).not.toBeNull();
  });
});

describe("removing a save", () => {
  it("deletes the files only it held, and keeps ones another save holds", async () => {
    start();
    lib.setSavedLibraryUser(1);
    await saveAndFinish("12", [track("71"), track("72")]);
    await saveAndFinish("13", [track("72"), track("74")]);

    await lib.removeSaved("album", "12");

    expect(fs.fakeFileExists(`${DIRECTORY}/71.flac`)).toBe(false);
    expect(fs.fakeFileExists(`${DIRECTORY}/72.flac`)).toBe(true);
    expect(lib.savedFilePath("71")).toBeNull();
    expect(lib.savedFilePath("72")).not.toBeNull();
  });

  it("stops a download in progress", async () => {
    start();
    lib.setSavedLibraryUser(1);
    lib.saveAlbum({ ref: "12", route, tracks: [track("71"), track("72")] });
    await settle();

    await lib.removeSaved("album", "12");
    await settle();

    expect(fs.downloads).toHaveLength(1);
    expect(fs.downloads[0].cancelled).toBe(true);
  });
});

describe("a song saved on its own", () => {
  const song = {
    id: "71",
    title: "Track 71",
    artist: "Radiohead",
    album: "Kid A",
    duration: 0,
    url: "https://music.example/stream",
    artwork: null,
    streamPath: "/library/stream/12/71",
    coverPath: null,
    trackMbid: null,
    artistMbid: null,
    albumMbid: null,
    favorite: null,
    audioFormat: "AAC",
  };

  it("is named for its codec's container, so iOS can play it", async () => {
    start();
    lib.setSavedLibraryUser(1);
    lib.saveSong(song);
    await settle();

    expect(fs.downloads[0].destination).toBe(`${DIRECTORY}/71.m4a`);
  });

  it("stays on the phone when the album that also holds it goes", async () => {
    start();
    lib.setSavedLibraryUser(1);
    await saveAndFinish("12", [track("71"), track("72")]);
    lib.saveSong(song);
    await settle();
    // Already on the phone with the album, so nothing is fetched again.
    expect(fs.downloads).toHaveLength(0);

    await lib.removeSaved("album", "12");

    expect(lib.savedFilePath("71")).not.toBeNull();
    expect(lib.savedFilePath("72")).toBeNull();
  });
});

describe("a refused session", () => {
  it("waits for a new token, then asks for the same file with it", async () => {
    const client = start();
    lib.setSavedLibraryUser(1);
    const refused = jest.fn();
    lib.onSaveRefused(refused);
    lib.saveAlbum({ ref: "12", route, tracks: [track("71"), track("72")] });
    await settle();

    fs.downloads[0].fail("server returned HTTP 401");
    await settle();
    expect(refused).toHaveBeenCalledTimes(1);
    expect(fs.downloads).toHaveLength(1);

    client.setAuthToken("token-2");
    lib.resumeSaving();
    await settle();

    expect(fs.downloads).toHaveLength(2);
    expect(fs.downloads[1].url).toBe(
      `${SERVER}/api/library/stream/12/71?token=token-2`,
    );
  });
});

describe("a file the server has lost", () => {
  it("leaves the album incomplete until Try Again asks once more", async () => {
    start();
    lib.setSavedLibraryUser(1);
    const { result } = await renderHook(() =>
      lib.useSavedStatus("album", "12"),
    );

    await act(async () => {
      lib.saveAlbum({ ref: "12", route, tracks: [track("71"), track("72")] });
      await settle();
      fs.downloads[0].fail("HTTP 404");
      await settle();
      fs.downloads[1].finish(1_000);
      await settle();
    });
    expect(result.current).toMatchObject({
      state: "incomplete",
      saved: 1,
      failed: 1,
    });

    await act(async () => {
      lib.retrySaved("album", "12");
      await settle();
    });
    expect(fs.downloads[2].destination).toBe(`${DIRECTORY}/71.flac`);
    expect(result.current?.state).toBe("saving");
  });
});

describe("a busy server", () => {
  it("gets another go at the same file after a moment", async () => {
    start();
    lib.setSavedLibraryUser(1);
    lib.saveAlbum({ ref: "12", route, tracks: [track("71"), track("72")] });
    await settle();

    fs.downloads[0].fail("HTTP 503");
    await new Promise((resolve) => setTimeout(resolve, 2_100));
    await settle();

    expect(fs.downloads[1].destination).toBe(`${DIRECTORY}/71.flac`);
  }, 10_000);
});

describe("with no connection", () => {
  it("waits, and carries on once the connection is back", async () => {
    start({ offline: true });
    lib.setSavedLibraryUser(1);
    lib.saveAlbum({ ref: "12", route, tracks: [track("71")] });
    await settle();
    expect(fs.downloads).toHaveLength(0);

    const [[onChange]] = network.addNetworkStateListener.mock.calls;
    onChange({ isConnected: true, isInternetReachable: true });
    await settle();

    expect(fs.downloads).toHaveLength(1);
  });
});

describe("with Wi-Fi Only on", () => {
  it("waits out cellular, and stops a save when the phone moves onto it", async () => {
    start({ metered: true });
    require("@/lib/player/playback-settings").setPlaybackSettings({
      wifiOnly: true,
    });
    lib.setSavedLibraryUser(1);
    lib.saveAlbum({ ref: "12", route, tracks: [track("71")] });
    await settle();
    expect(fs.downloads).toHaveLength(0);

    const [[onChange]] = network.addNetworkStateListener.mock.calls;
    onChange({ isConnected: true, isMetered: false });
    await settle();
    expect(fs.downloads).toHaveLength(1);

    onChange({ isConnected: true, isMetered: true });
    await settle();
    expect(fs.downloads[0].cancelled).toBe(true);
    expect(fs.downloads).toHaveLength(1);
    expect(lib.savedFilePath("71")).toBeNull();
  });
});

describe("at launch", () => {
  it("saves again a file that has gone, keeps one that's there, and deletes files it doesn't know", async () => {
    const file = (name: string, bytes: number | null) => ({
      streamPath: `/library/stream/12/${name}`,
      name: `${name}.flac`,
      expectedBytes: 1_000,
      bytes,
      failed: false,
    });
    start({
      record: {
        version: 1,
        items: [
          {
            kind: "album",
            id: "12",
            userId: 1,
            savedAt: 1,
            route,
            tracks: [track("71"), track("72")],
          },
        ],
        files: { "71": file("71", 1_000), "72": file("72", 1_000) },
      },
      files: { "72.flac": 1_000, "99.flac": 500 },
    });
    lib.setSavedLibraryUser(1);
    await settle();

    expect(lib.savedFilePath("72")).toBe("/documents/saved-offline/72.flac");
    expect(lib.savedFilePath("71")).toBeNull();
    expect(fs.downloads.map((download) => download.destination)).toEqual([
      `${DIRECTORY}/71.flac`,
    ]);
    expect(fs.fakeFileExists(`${DIRECTORY}/99.flac`)).toBe(false);
  });
});

describe("a save from before Aurral 3.0", () => {
  it("plays its files from the phone, saves a lost one from the renamed route, and writes the record in the new form", async () => {
    const oldPath = (id: string) => `/library/canonical-stream/12/${id}`;
    const file = (id: string) => ({
      streamPath: oldPath(id),
      name: `${id}.flac`,
      expectedBytes: 1_000,
      bytes: 1_000,
      failed: false,
    });
    start({
      record: {
        version: 1,
        items: [
          {
            kind: "album",
            id: "12",
            userId: 1,
            savedAt: 1,
            route: {
              title: "Kid A",
              artistName: "Radiohead",
              artistMbid: "artist-mb",
              albumMbid: "album-mb",
              coverUrl: "",
              lidarrAlbumId: "",
              canonicalAlbumId: "12",
              artistId: "",
            },
            tracks: ["71", "72"].map((id) =>
              track(id, { streamPath: oldPath(id) }),
            ),
          },
          {
            kind: "song",
            id: "73",
            userId: 1,
            savedAt: 2,
            track: { id: "73", title: "Track 73", streamPath: oldPath("73") },
          },
        ],
        files: { "71": file("71"), "72": file("72"), "73": file("73") },
      },
      files: { "71.flac": 1_000, "73.flac": 1_000 },
    });
    lib.setSavedLibraryUser(1);
    await settle();

    expect(lib.savedFilePath("71")).toBe("/documents/saved-offline/71.flac");
    expect(fs.downloads.map((download) => download.url)).toEqual([
      `${SERVER}/api/library/stream/12/72?token=token-1`,
    ]);
    const record = (await storage.getItem("saved_offline"))!;
    expect(record).not.toContain("canonical-stream");
    expect(JSON.parse(record).items[0].route).toEqual(route);
  });
});

describe("loudness", () => {
  function serveLoudness(lufs: string) {
    const { fetch } = require("expo/fetch");
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => lufs },
    });
  }

  it("keeps Aurral's measurement with a saved file, so it's levelled offline after a restart", async () => {
    start();
    serveLoudness("-9.5");
    lib.setSavedLibraryUser(1);
    await saveAndFinish("12", [track("71")]);
    await settle();
    expect(lib.savedLoudness("71")).toBe(-9.5);

    const record = JSON.parse((await storage.getItem("saved_offline"))!);
    start({ record, files: { "71.flac": 1_000 }, offline: true });
    lib.setSavedLibraryUser(1);
    await settle();

    expect(lib.savedLoudness("71")).toBe(-9.5);
  });

  it("gives a file saved without a measurement the one the player hears", async () => {
    start({
      record: {
        version: 1,
        items: [
          {
            kind: "album",
            id: "12",
            userId: 1,
            savedAt: 1,
            route,
            tracks: [track("71")],
          },
        ],
        files: {
          "71": {
            streamPath: "/library/stream/12/71",
            name: "71.flac",
            expectedBytes: 1_000,
            bytes: 1_000,
            failed: false,
          },
        },
      },
      files: { "71.flac": 1_000 },
    });
    serveLoudness("-7");
    lib.setSavedLibraryUser(1);
    await settle();

    require("@/lib/player/loudness").askLoudness(["/library/stream/12/71"]);
    await settle();

    expect(lib.savedLoudness("71")).toBe(-7);
    const record = JSON.parse((await storage.getItem("saved_offline"))!);
    expect(record.files["71"].loudness).toBe(-7);
  });
});

/** Lets every file waiting to save finish, one at a time. */
async function finishAll() {
  await settle();
  while (fs.downloads.some((download) => !download.cancelled)) {
    const pending = fs.downloads.splice(0);
    pending.forEach((download) => download.finish(1_000));
    await settle();
  }
}

describe("Favorites", () => {
  /** A favorite song as the queue keeps it. */
  function favoriteSong(
    id: string,
  ): Omit<PlayerTrack, "url" | "duration"> & { streamPath: string } {
    return {
      id,
      title: `Track ${id}`,
      artist: "Radiohead",
      album: "Kid A",
      artwork: null,
      streamPath: `/library/stream/12/${id}`,
      coverPath: null,
      trackMbid: null,
      artistMbid: null,
      albumMbid: null,
      favorite: { kind: "song", key: `recording:${id}` },
      audioFormat: "FLAC",
    };
  }

  /** A favorite song with the Favorites row it came from. */
  const favorite = (id: string) => ({
    track: favoriteSong(id),
    row: track(id),
  });

  const saved = (id: string, extension = "flac") =>
    fs.fakeFileExists(`${DIRECTORY}/${id}.${extension}`);

  it("saves favorite songs, lets go of one two reads leave out, and keeps one saved by hand too", async () => {
    start();
    lib.setSavedLibraryUser(1);
    await lib.setFavoritesSave("songs");
    await lib.applyFavorites({
      songs: [favorite("71"), favorite("72")],
      albums: [],
    });
    await finishAll();
    expect(saved("71")).toBe(true);
    expect(saved("72")).toBe(true);
    // Its song menu can't remove it while Favorites keeps it.
    const { result } = await renderHook(() => lib.useTrackSaves());
    expect(result.current("71")).toEqual({ kind: "held", by: "Favorites" });

    await act(async () => {
      lib.saveSong({
        ...favoriteSong("72"),
        duration: 0,
        url: "https://music.example/stream",
      });
      await settle();
    });
    // One read can miss a favorite as its pages shift, so it takes two.
    await lib.applyFavorites({ songs: [], albums: [] });
    await settle();
    expect(saved("71")).toBe(true);
    await lib.applyFavorites({ songs: [], albums: [] });
    await settle();

    expect(saved("71")).toBe(false);
    expect(lib.savedFilePath("72")).not.toBeNull();
    expect(result.current("72")).toEqual({ kind: "own", state: "saved" });
  });

  it("keeps favorite albums only with Songs and Albums, and turning it off removes only what Favorites alone kept", async () => {
    start();
    lib.setSavedLibraryUser(1);
    // Saved by hand before it was a favorite.
    await saveAndFinish("13", [track("74")]);
    await lib.setFavoritesSave("songs-and-albums");
    await lib.applyFavorites({
      songs: [favorite("71")],
      albums: [
        { ref: "12", route, tracks: [track("72"), track("73")] },
        { ref: "13", route, tracks: [track("74")] },
        // Its tracks couldn't be read, so it waits for the next read.
        { ref: "14", route, tracks: null },
      ],
    });
    await finishAll();
    expect(["71", "72", "73", "74"].map((id) => saved(id))).toEqual([
      true,
      true,
      true,
      true,
    ]);

    await lib.setFavoritesSave("songs");
    await settle();
    expect(saved("71")).toBe(true);
    expect(saved("72")).toBe(false);
    expect(saved("73")).toBe(false);
    expect(saved("74")).toBe(true);

    await lib.setFavoritesSave(null);
    await settle();
    expect(saved("71")).toBe(false);
    expect(saved("74")).toBe(true);
    const { result } = await renderHook(() => lib.useSavedItems());
    expect(result.current.map((save) => save.item.id)).toEqual(["13"]);
  });

  it("remembers what each account's Favorites saves across a restart", async () => {
    start();
    lib.setSavedLibraryUser(1);
    await lib.setFavoritesSave("songs-and-albums");
    await settle();
    const record = JSON.parse((await storage.getItem("saved_offline"))!);

    start({ record });
    lib.setSavedLibraryUser(2);
    await settle();
    const { result } = await renderHook(() => lib.useFavoritesSave());
    expect(result.current).toBeNull();

    await act(async () => {
      lib.setSavedLibraryUser(1);
      await settle();
    });
    expect(result.current).toBe("songs-and-albums");
  });
});

describe("a playlist saved with Keep Updated", () => {
  const playlist = { id: "pl-1", name: "Road Trip" } as SharedPlaylist;
  const job = (id: string, status: FlowJob["status"] = "done") =>
    ({ id, status, streamFormat: "flac" }) as FlowJob;
  const saved = (id: string) => fs.fakeFileExists(`${DIRECTORY}/${id}.flac`);

  it("saves tracks the playlist finishes and lets go of ones it drops, keeping a saved one the server works on again", async () => {
    start();
    lib.setSavedLibraryUser(1);
    lib.savePlaylist(
      { playlist, jobs: [job("a"), job("b")] },
      { keepUpdated: true },
    );
    await finishAll();

    await lib.refreshSavedPlaylist({
      id: "pl-1",
      jobs: [job("a", "downloading"), job("c"), job("d", "pending")],
    });
    await finishAll();

    expect(saved("a")).toBe(true);
    expect(saved("b")).toBe(false);
    expect(saved("c")).toBe(true);
    expect(saved("d")).toBe(false);
  });

  it("leaves a playlist saved without it as it was saved", async () => {
    start();
    lib.setSavedLibraryUser(1);
    lib.savePlaylist({ playlist, jobs: [job("a"), job("b")] });
    await finishAll();

    await lib.refreshSavedPlaylist({ id: "pl-1", jobs: [job("c")] });
    await finishAll();

    expect([saved("a"), saved("b"), saved("c")]).toEqual([true, true, false]);
  });
});

describe("forgetting everything", () => {
  it("deletes every account's files and the record", async () => {
    start();
    lib.setSavedLibraryUser(1);
    await saveAndFinish("12", [track("71")]);
    lib.setSavedLibraryUser(2);
    await saveAndFinish("13", [track("74")]);

    await lib.forgetSavedLibrary();

    expect(fs.fakeFileExists(`${DIRECTORY}/71.flac`)).toBe(false);
    expect(fs.fakeFileExists(`${DIRECTORY}/74.flac`)).toBe(false);
    expect(await storage.getItem("saved_offline")).toBeNull();
    lib.setSavedLibraryUser(1);
    await settle();
    expect(lib.savedFilePath("71")).toBeNull();
  });
});
