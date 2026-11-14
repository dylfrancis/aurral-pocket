import type * as PlaybackSettings from "@/lib/player/playback-settings";

// The settings and the storage mock both keep module state. Each start loads
// fresh copies, as a cold start would, over the record the last one left.
let settings: typeof PlaybackSettings;
let storage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const KEY = "playback_settings";

/** A cold start that finds `record` stored. */
async function start(record: string | null = null, { read = true } = {}) {
  jest.resetModules();
  storage = require("@react-native-async-storage/async-storage");
  if (record) await storage.setItem(KEY, record);
  settings = require("@/lib/player/playback-settings");
  if (read) await settings.playbackSettingsReady();
}

/** Start again from what this run stored. */
async function restart(options?: { read?: boolean }) {
  await start(await storage.getItem(KEY), options);
}

/** Lets the chained storage write land. */
async function settle() {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe("playback settings", () => {
  it("start at one track ahead, a gigabyte of cache, no queue limit and Wi-Fi Only off", async () => {
    await start();

    expect(settings.getPlaybackSettings()).toEqual({
      prefetchAhead: 1,
      queueLimit: 0,
      cacheBytes: 1_000_000_000,
      wifiOnly: false,
    });
  });

  it("come back after a restart", async () => {
    await start();
    settings.setPlaybackSettings({ prefetchAhead: 3, wifiOnly: true });
    settings.setPlaybackSettings({ cacheBytes: 5_000_000_000 });
    await settle();

    await restart();

    expect(settings.getPlaybackSettings()).toEqual({
      prefetchAhead: 3,
      queueLimit: 0,
      cacheBytes: 5_000_000_000,
      wifiOnly: true,
    });
  });

  it("keep the stored ones when one changes before they're read", async () => {
    await start();
    settings.setPlaybackSettings({ prefetchAhead: 10 });
    await settle();

    await restart({ read: false });
    settings.setPlaybackSettings({ queueLimit: 50 });
    await settle();
    await restart();

    expect(settings.getPlaybackSettings()).toEqual(
      expect.objectContaining({ prefetchAhead: 10, queueLimit: 50 }),
    );
  });

  it("fall back to the default for a value no longer offered", async () => {
    await start(
      JSON.stringify({ prefetchAhead: 7, queueLimit: 100, cacheBytes: 3 }),
    );

    expect(settings.getPlaybackSettings()).toEqual({
      prefetchAhead: 1,
      queueLimit: 100,
      cacheBytes: 1_000_000_000,
      wifiOnly: false,
    });
  });
});
