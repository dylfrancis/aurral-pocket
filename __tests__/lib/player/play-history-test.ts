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
  onTrackCompleted: jest.fn(() => () => {}),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "@/lib/api/client";
import { recordPlayEvent } from "@/lib/api/play-events";
import { forgetPlayHistory, startPlayHistory } from "@/lib/player/play-history";
import { onProgress, onTrackCompleted } from "@/lib/player/player";
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
    trackMbid: "track-mb-1",
    artistMbid: "artist-mb-1",
    albumMbid: "album-mb-1",
    ...overrides,
  };
}

/** Torn down between tests, so no run's progress reaches the next. */
let stopCurrent: (() => void) | null = null;

/** Start reporting and hand back the two listeners the player would call. */
function start() {
  const stop = startPlayHistory();
  stopCurrent = stop;
  const progress = (onProgress as jest.Mock).mock.calls[0][0] as (
    value: PlaybackProgress,
  ) => void;
  const completed = (onTrackCompleted as jest.Mock).mock.calls[0][0] as (
    value: PlayerTrack,
  ) => void;
  return { stop, progress, completed };
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
  it("reports a track that played to its end", async () => {
    const { progress, completed } = start();

    progress({ trackId: "77", position: 250, duration: 251 });
    completed(track());
    await settle();

    expect(mockRecord).toHaveBeenCalledWith({
      trackId: "77",
      title: "Everything In Its Right Place",
      artist: "Radiohead",
      album: "Kid A",
      artistMbid: "artist-mb-1",
      albumMbid: "album-mb-1",
      trackMbid: "track-mb-1",
      durationMs: 251_000,
      playedAt: 1_800_000_000_000,
      source: "pocket",
    });
    expect(outbox()).toEqual([]);
  });

  // A preview clip is a 30-second sample the user did not choose to hear.
  it("ignores a preview clip", async () => {
    const { completed } = start();

    completed(track({ streamPath: null }));
    await settle();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  // The engine learns a track's length from the stream, so the queued track
  // carries none. A play with no length is still a play.
  it("reports no duration when the engine never gave one", async () => {
    const { completed } = start();

    completed(track());
    await settle();

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ durationMs: null }),
    );
  });

  it("ignores a duration measured against a different track", async () => {
    const { progress, completed } = start();

    progress({ trackId: "78", position: 10, duration: 180 });
    completed(track());
    await settle();

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ durationMs: null }),
    );
  });

  it("keeps a play the server never received", async () => {
    mockRecord.mockRejectedValue(new ApiError(0, "Network request failed"));
    const { completed } = start();

    completed(track());
    await settle();

    expect(outbox()).toEqual([expect.objectContaining({ trackId: "77" })]);
  });

  // A payload the server refuses on its merits never becomes acceptable, and
  // holding it would block every later play behind it.
  it("drops a play the server rejected", async () => {
    mockRecord.mockRejectedValue(new ApiError(400, "trackId is required"));
    const { completed } = start();

    completed(track());
    await settle();

    expect(outbox()).toEqual([]);
  });

  it("keeps a play refused for an expired session", async () => {
    mockRecord.mockRejectedValue(new ApiError(401, "Session expired"));
    const { completed } = start();

    completed(track());
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
    const stopCompleted = jest.fn();
    (onProgress as jest.Mock).mockReturnValueOnce(stopProgress);
    (onTrackCompleted as jest.Mock).mockReturnValueOnce(stopCompleted);

    startPlayHistory()();

    expect(stopProgress).toHaveBeenCalled();
    expect(stopCompleted).toHaveBeenCalled();
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
