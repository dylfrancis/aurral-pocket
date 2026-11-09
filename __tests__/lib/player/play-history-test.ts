jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("@/lib/api/play-events", () => ({
  recordPlayEvent: jest.fn(),
}));

jest.mock("@/lib/player/player", () => ({
  onProgress: jest.fn(() => () => {}),
  onTrackStarted: jest.fn(() => () => {}),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "@/lib/api/client";
import { recordPlayEvent } from "@/lib/api/play-events";
import { forgetPlayHistory, startPlayHistory } from "@/lib/player/play-history";
import { onProgress, onTrackStarted } from "@/lib/player/player";
import type { PlaybackProgress } from "@/lib/player/player";
import type { PlayerTrack } from "@/lib/player/track-item";

const mockRecord = recordPlayEvent as jest.Mock;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const OUTBOX_KEY = "play_event_outbox";

/** The outbox as storage holds it, so a test can seed it and read it back. */
let stored: string | null = null;

function track(overrides: Partial<PlayerTrack> = {}): PlayerTrack {
  return {
    id: "77",
    title: "Everything In Its Right Place",
    artist: "Radiohead",
    album: "Kid A",
    duration: 0,
    url: "https://test.example/api/library/canonical-stream/12/77",
    artwork: null,
    streamPath: "/library/canonical-stream/12/77",
    coverPath: null,
    trackMbid: "track-mb-1",
    artistMbid: "artist-mb-1",
    albumMbid: "album-mb-1",
    favorite: null,
    ...overrides,
  };
}

/** Torn down between tests, so no run's progress reaches the next. */
let stopCurrent: (() => void) | null = null;

/** Start reporting and play the part of the player that drives it. */
function start() {
  const stop = startPlayHistory();
  stopCurrent = stop;
  const progress = (onProgress as jest.Mock).mock.calls[0][0] as (
    value: PlaybackProgress,
  ) => void;
  const started = (onTrackStarted as jest.Mock).mock.calls[0][0] as (
    value: PlayerTrack,
  ) => void;

  /** One progress report a second, from one position to another. */
  function listen(
    from: number,
    to: number,
    { playing = track(), duration = 200 } = {},
  ): void {
    for (let position = from; position <= to; position += 1) {
      progress({ track: playing, position, duration, seeked: false });
    }
  }

  /** The report that follows a seek. */
  function seek(position: number): void {
    progress({ track: track(), position, duration: 200, seeked: true });
  }

  return { started, progress, listen, seek };
}

/** Let the module's write-and-send chain run to its end. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function outbox(): unknown[] {
  return stored === null ? [] : JSON.parse(stored);
}

beforeEach(() => {
  jest.clearAllMocks();
  stored = null;
  mockAsyncStorage.getItem.mockImplementation(async (key) =>
    key === OUTBOX_KEY ? stored : null,
  );
  mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
    if (key === OUTBOX_KEY) stored = value;
  });
  mockAsyncStorage.removeItem.mockImplementation(async (key) => {
    if (key === OUTBOX_KEY) stored = null;
  });
  mockRecord.mockResolvedValue(null);
  jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
});

afterEach(() => {
  stopCurrent?.();
  stopCurrent = null;
  jest.restoreAllMocks();
});

describe("startPlayHistory", () => {
  it("reports what played once the listener reaches the threshold", async () => {
    const { listen } = start();

    listen(0, 126, { duration: 251.2 });
    await settle();

    expect(mockRecord).toHaveBeenCalledWith({
      trackId: "77",
      title: "Everything In Its Right Place",
      artist: "Radiohead",
      album: "Kid A",
      artistMbid: "artist-mb-1",
      albumMbid: "album-mb-1",
      trackMbid: "track-mb-1",
      durationMs: 251_200,
      playedAt: 1_800_000_000_000,
      source: "pocket",
    });
    expect(outbox()).toEqual([]);
  });

  it.each([
    { duration: 200, threshold: 100 },
    { duration: 600, threshold: 240 },
    { duration: 31, threshold: 16 },
  ])(
    "reports a $duration-second track at $threshold seconds, and only then",
    async ({ duration, threshold }) => {
      const { listen } = start();

      listen(0, threshold - 1, { duration });
      await settle();
      expect(mockRecord).not.toHaveBeenCalled();

      listen(threshold, threshold, { duration });
      await settle();
      expect(mockRecord).toHaveBeenCalledTimes(1);

      listen(threshold + 1, duration, { duration });
      await settle();
      expect(mockRecord).toHaveBeenCalledTimes(1);
    },
  );

  it.each([30, 12])("never reports a %d-second track", async (duration) => {
    const { listen } = start();

    listen(0, duration, { duration });
    await settle();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  // A preview clip is a 30-second sample the user did not choose to hear.
  it("ignores a preview clip", async () => {
    const { listen } = start();

    listen(0, 200, { playing: track({ streamPath: null }) });
    await settle();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("ignores a track from a playlist that opted out", async () => {
    const { listen } = start();

    listen(0, 200, { playing: track({ recordHistory: false }) });
    await settle();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("does not count a seek past the threshold as listening", async () => {
    const { listen, seek } = start();

    listen(0, 10);
    seek(150);
    listen(151, 200);
    await settle();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("does not count a run of short seeks as listening", async () => {
    const { seek } = start();

    for (let position = 5; position < 200; position += 5) seek(position);
    await settle();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("does not count a jump the engine did not flag as a seek", async () => {
    const { listen } = start();

    listen(0, 10);
    listen(150, 200);
    await settle();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("adds up the listening on either side of a seek", async () => {
    const { listen, seek } = start();

    listen(0, 60);
    seek(150);
    listen(151, 190);
    await settle();

    expect(mockRecord).toHaveBeenCalledTimes(1);
  });

  // The web player treats a seek back as more of the same play, not a new one.
  it("keeps a seek back to the start within the same play", async () => {
    const { listen, seek } = start();

    listen(0, 60);
    seek(0);
    listen(1, 150);
    await settle();

    expect(mockRecord).toHaveBeenCalledTimes(1);
  });

  // The engine learns a track's length from the stream, so listening has to
  // count from before the length arrives.
  it("counts listening from before the engine knows the length", async () => {
    const { listen } = start();

    listen(0, 120, { duration: 0 });
    await settle();
    expect(mockRecord).not.toHaveBeenCalled();

    listen(121, 121);
    await settle();
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ durationMs: 200_000 }),
    );
  });

  it("starts counting afresh when the next track starts", async () => {
    const { listen, started } = start();

    listen(0, 90);
    started(track({ id: "78" }));
    listen(0, 90, { playing: track({ id: "78" }) });
    await settle();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  // The next track's first report can arrive before its track change.
  it("does not measure a skipped track against the next one's length", async () => {
    const { listen, progress } = start();

    listen(0, 60, { duration: 300 });
    progress({ track: track(), position: 0.5, duration: 100, seeked: false });
    await settle();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("reports a track played twice in a row as two plays", async () => {
    const { listen, started } = start();

    listen(0, 200);
    started(track());
    listen(0, 200);
    await settle();

    expect(mockRecord).toHaveBeenCalledTimes(2);
  });

  it("keeps a play the server never received", async () => {
    mockRecord.mockRejectedValue(new ApiError(0, "Network request failed"));
    const { listen } = start();

    listen(0, 100);
    await settle();

    expect(outbox()).toEqual([expect.objectContaining({ trackId: "77" })]);
  });

  // A payload the server refuses on its merits never becomes acceptable, and
  // holding it would block every later play behind it.
  it("drops a play the server rejected", async () => {
    mockRecord.mockRejectedValue(new ApiError(400, "trackId is required"));
    const { listen } = start();

    listen(0, 100);
    await settle();

    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(outbox()).toEqual([]);
  });

  it("keeps a play refused for an expired session", async () => {
    mockRecord.mockRejectedValue(new ApiError(401, "Session expired"));
    const { listen } = start();

    listen(0, 100);
    await settle();

    expect(outbox()).toEqual([expect.objectContaining({ trackId: "77" })]);
  });

  it("sends what the last run held over, oldest first", async () => {
    stored = JSON.stringify([
      { ...held("1"), playedAt: 1 },
      { ...held("2"), playedAt: 2 },
    ]);

    start();
    await settle();

    expect(mockRecord.mock.calls.map(([event]) => event.trackId)).toEqual([
      "1",
      "2",
    ]);
    expect(outbox()).toEqual([]);
  });

  it("stops at the first play the server would not take", async () => {
    stored = JSON.stringify([held("1"), held("2")]);
    mockRecord
      .mockResolvedValueOnce(null)
      .mockRejectedValue(new ApiError(0, "Network request failed"));

    start();
    await settle();

    expect(outbox()).toEqual([expect.objectContaining({ trackId: "2" })]);
  });

  it("discards a stored outbox that is not readable", async () => {
    stored = "{ not json";

    start();
    await settle();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("stops reporting once the listeners are removed", () => {
    const stopProgress = jest.fn();
    const stopStarted = jest.fn();
    (onProgress as jest.Mock).mockReturnValueOnce(stopProgress);
    (onTrackStarted as jest.Mock).mockReturnValueOnce(stopStarted);

    startPlayHistory()();

    expect(stopProgress).toHaveBeenCalled();
    expect(stopStarted).toHaveBeenCalled();
  });
});

describe("forgetPlayHistory", () => {
  it("drops plays the signed-out account had not reported", async () => {
    stored = JSON.stringify([held("1")]);

    await forgetPlayHistory();

    expect(stored).toBeNull();
  });
});

function held(trackId: string) {
  return {
    trackId,
    title: "Held",
    artist: "Radiohead",
    album: null,
    artistMbid: null,
    albumMbid: null,
    trackMbid: null,
    durationMs: null,
    playedAt: 1_800_000_000_000,
    source: "pocket",
  };
}
