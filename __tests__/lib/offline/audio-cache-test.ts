import type * as AudioCache from "@/lib/offline/audio-cache";
import type * as Settings from "@/lib/player/playback-settings";
import type * as FakeFileSystem from "@/test-support/expo-file-system";

// The cache, the settings, the storage mock and the fake disk all keep module
// state. Each test loads fresh copies, as a cold start would, after seeding
// what a restart finds.
let cache: typeof AudioCache;
let settings: typeof Settings;
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
const DIRECTORY = "file:///caches/prefetch";
const MB = 1_000_000;

function start({
  record,
  files = {},
  metered = false,
}: {
  record?: unknown;
  files?: Record<string, number>;
  metered?: boolean;
} = {}) {
  jest.resetModules();
  storage = require("@react-native-async-storage/async-storage");
  network = require("expo-network");
  fs = require("@/test-support/expo-file-system");
  const client = require("@/lib/api/client");

  client.setBaseUrl(SERVER);
  client.setAuthToken("token-1");
  client.setCustomHeaders({ "CF-Access-Client-Id": "proxy-id" });
  if (record) void storage.setItem("audio_cache", JSON.stringify(record));
  for (const [name, bytes] of Object.entries(files)) {
    fs.writeFakeFile(`${DIRECTORY}/${name}`, bytes);
  }
  network.getNetworkStateAsync.mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    isMetered: metered,
  });

  settings = require("@/lib/player/playback-settings");
  cache = require("@/lib/offline/audio-cache");
  return client;
}

/** Lets storage reads, writes and download hand-offs land. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function track(id: string): AudioCache.PrefetchTrack {
  return {
    id,
    streamPath: `/library/canonical-stream/12/${id}`,
    audioFormat: "FLAC",
  };
}

/** The player wants these tracks up next, while `playing` plays. */
async function want(
  ids: string[],
  {
    playing = null,
    paused = false,
  }: { playing?: string | null; paused?: boolean } = {},
) {
  cache.setPrefetchWindow(ids.map(track), playing, !paused);
  await settle();
}

/** Finish each fetch as it starts, at `bytes` each, until none is left. */
async function finishAll(bytes: number) {
  while (fs.downloads.some((download) => !download.cancelled)) {
    fs.downloads.splice(0).forEach((download) => download.finish(bytes));
    await settle();
  }
}

function onDisk(): string[] {
  return ["1", "2", "3", "4"].filter((id) => cache.cachedFilePath(id));
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("fetching ahead", () => {
  it("fetches the tracks up next one at a time, with the session's URL and the proxy headers", async () => {
    start();
    const changed = jest.fn();
    cache.onCachedFilesChange(changed);

    await want(["1", "2"]);

    expect(fs.downloads).toHaveLength(1);
    expect(fs.downloads[0]).toMatchObject({
      url: `${SERVER}/api/library/canonical-stream/12/1?token=token-1`,
      destination: `${DIRECTORY}/1.flac`,
      headers: { "CF-Access-Client-Id": "proxy-id" },
      // A background session started on a locked phone can wait on iOS.
      sessionType: "foreground",
    });

    fs.downloads[0].finish(MB);
    await settle();
    expect(cache.cachedFilePath("1")).toBe("/caches/prefetch/1.flac");
    expect(changed).toHaveBeenLastCalledWith(["1"]);
    expect(fs.downloads[1].url).toBe(
      `${SERVER}/api/library/canonical-stream/12/2?token=token-1`,
    );

    fs.downloads[1].finish(MB);
    await settle();
    expect(fs.downloads).toHaveLength(2);
    // No session token reaches the phone's storage.
    expect(await storage.getItem("audio_cache")).not.toContain("token-1");
  });

  it("names each file by its format, which iOS needs to play it", async () => {
    start();
    cache.setPrefetchWindow(
      [
        { ...track("1"), audioFormat: "WAV" },
        { ...track("2"), audioFormat: "AAC" },
      ],
      null,
      true,
    );
    await settle();
    fs.downloads[0].finish(MB);
    await settle();

    expect(fs.downloads.map((download) => download.destination)).toEqual([
      `${DIRECTORY}/1.wav`,
      `${DIRECTORY}/2.m4a`,
    ]);
  });

  it("starts no fetch while the player is paused, and lets one under way finish", async () => {
    start();
    await want(["1", "2"], { paused: true });
    expect(fs.downloads).toHaveLength(0);

    await want(["1", "2"]);
    expect(fs.downloads).toHaveLength(1);

    await want(["1", "2"], { paused: true });
    fs.downloads[0].finish(MB);
    await settle();

    expect(fs.downloads[0].cancelled).toBe(false);
    expect(onDisk()).toEqual(["1"]);
    expect(fs.downloads).toHaveLength(1);
  });

  it("drops a fetch the player no longer wants for what it wants now", async () => {
    start();
    await want(["1", "2"]);

    await want(["3", "4"]);

    expect(fs.downloads[0].cancelled).toBe(true);
    expect(fs.downloads[1].destination).toBe(`${DIRECTORY}/3.flac`);
  });

  it("waits for a new token when the server refuses the session", async () => {
    const client = start();
    const refused = jest.fn();
    cache.onPrefetchRefused(refused);
    await want(["1"]);

    fs.downloads[0].fail("server returned HTTP 401");
    await settle();
    expect(refused).toHaveBeenCalledTimes(1);
    expect(fs.downloads).toHaveLength(1);

    client.setAuthToken("token-2");
    cache.resumePrefetch();
    await settle();

    expect(fs.downloads[1].url).toBe(
      `${SERVER}/api/library/canonical-stream/12/1?token=token-2`,
    );
  });
});

describe("the cache size", () => {
  it("evicts the least recently played first, and tells the player", async () => {
    start();
    let clock = 0;
    jest.spyOn(Date, "now").mockImplementation(() => ++clock);
    settings.setPlaybackSettings({ cacheBytes: 500 * MB });
    const changed = jest.fn();
    cache.onCachedFilesChange(changed);
    await want(["1", "2", "3"]);
    await finishAll(150 * MB);
    // Track 1 plays again after 2 and 3 were fetched.
    cache.markPlayed("1");

    await want(["4"]);
    await finishAll(150 * MB);

    expect(onDisk()).toEqual(["1", "3", "4"]);
    expect(fs.fakeFileExists(`${DIRECTORY}/2.flac`)).toBe(false);
    expect(changed).toHaveBeenCalledWith(["2"]);
  });

  it("fetches no further ahead than it holds, and never evicts the track playing", async () => {
    start();
    settings.setPlaybackSettings({ cacheBytes: 500 * MB });
    await want(["1", "2", "3"]);

    await finishAll(200 * MB);

    // Track 3 didn't fit beside 1 and 2, so it went, and isn't asked for again.
    expect(onDisk()).toEqual(["1", "2"]);
    expect(fs.downloads).toHaveLength(0);

    // Track 1 plays from its file, so it still takes its room.
    await want(["2", "3"], { playing: "1" });
    expect(fs.downloads).toHaveLength(0);

    // Once it's played, it makes room.
    await want(["3", "4"], { playing: "2" });
    await finishAll(200 * MB);

    expect(onDisk()).toEqual(["2", "3"]);
  });
});

describe("Clear Cache", () => {
  it("deletes all but the track playing, and fetches again from the next one", async () => {
    start();
    const changed = jest.fn();
    cache.onCachedFilesChange(changed);
    await want(["1", "2"]);
    await finishAll(MB);
    await want(["3"], { playing: "2" });
    await finishAll(MB);

    await cache.clearAudioCache();
    await settle();

    // Deleting the playing track's file would break a seek.
    expect(onDisk()).toEqual(["2"]);
    expect(fs.fakeFileExists(`${DIRECTORY}/3.flac`)).toBe(false);
    // Track 3 goes back to its stream, and isn't fetched again at once.
    expect(changed).toHaveBeenLastCalledWith(["1", "3"]);
    expect(fs.downloads).toHaveLength(0);

    await want(["4"], { playing: "3" });

    expect(fs.downloads[0].destination).toBe(`${DIRECTORY}/4.flac`);
  });
});

describe("with Wi-Fi Only on", () => {
  it("waits out cellular, and stops a fetch when the phone moves onto it", async () => {
    start({ metered: true });
    settings.setPlaybackSettings({ wifiOnly: true });

    await want(["1"]);
    expect(fs.downloads).toHaveLength(0);

    const [[onChange]] = network.addNetworkStateListener.mock.calls;
    onChange({ isConnected: true, isMetered: false });
    await settle();
    expect(fs.downloads).toHaveLength(1);

    onChange({ isConnected: true, isMetered: true });
    await settle();
    expect(fs.downloads[0].cancelled).toBe(true);
    expect(fs.downloads).toHaveLength(1);
  });
});

describe("sign-out", () => {
  it("deletes every file and the record", async () => {
    start();
    await want(["1", "2"]);
    await finishAll(MB);

    await cache.forgetAudioCache();

    expect(onDisk()).toEqual([]);
    expect(fs.fakeFileExists(`${DIRECTORY}/1.flac`)).toBe(false);
    expect(await storage.getItem("audio_cache")).toBeNull();
  });
});

describe("at launch", () => {
  it("plays files still on the phone, forgets ones that are gone, and deletes strays", async () => {
    const file = (id: string) => ({ name: `${id}.flac`, bytes: MB, usedAt: 1 });
    start({
      record: { version: 1, files: { "1": file("1"), "2": file("2") } },
      files: { "1.flac": MB, "stray.flac": MB },
    });

    await cache.audioCacheReady();

    expect(onDisk()).toEqual(["1"]);
    expect(fs.fakeFileExists(`${DIRECTORY}/stray.flac`)).toBe(false);
  });
});
