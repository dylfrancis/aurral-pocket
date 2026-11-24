import { act, renderHook } from "@testing-library/react-native";

type Listener = ((arg?: any) => void) | null;
const mockListeners: { match: Listener; noMatch: Listener; error: Listener } = {
  match: null,
  noMatch: null,
  error: null,
};
const mockStart = jest.fn((_token: string | null) => Promise.resolve());
const mockStop = jest.fn(() => Promise.resolve());
let mockPaused: Promise<void> = Promise.resolve();
const mockRelease = jest.fn();
const mockResume = jest.fn(() => Promise.resolve());

jest.mock("@/lib/player/player", () => ({
  holdPlayback: () => ({ paused: mockPaused, release: mockRelease }),
  resumeAfterHold: () => mockResume(),
}));

jest.mock("@/modules/shazam", () => ({
  isShazamAvailable: true,
  startListening: (token: string | null) => mockStart(token),
  stopListening: () => mockStop(),
  addMatchListener: (cb: (m: any) => void) => {
    mockListeners.match = cb;
    return { remove: jest.fn() };
  },
  addNoMatchListener: (cb: () => void) => {
    mockListeners.noMatch = cb;
    return { remove: jest.fn() };
  },
  addErrorListener: (cb: (e: any) => void) => {
    mockListeners.error = cb;
    return { remove: jest.fn() };
  },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { shazamDeveloperToken: null } } },
}));

import { useShazam } from "@/hooks/shazam/use-shazam";

const MATCH = {
  title: "Song",
  artist: "Artist",
  album: null,
  artworkUrl: null,
  appleMusicUrl: null,
  isrc: null,
  shazamId: null,
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockListeners.match = null;
  mockListeners.noMatch = null;
  mockListeners.error = null;
  mockPaused = Promise.resolve();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useShazam", () => {
  it("starts idle and reports availability", async () => {
    const { result } = await renderHook(() => useShazam());
    expect(result.current.status).toBe("idle");
    expect(result.current.available).toBe(true);
  });

  it("start() begins listening and invokes the native module", async () => {
    const { result } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    expect(result.current.status).toBe("listening");
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("opens the mic only once the player has paused", async () => {
    const pause = deferred();
    mockPaused = pause.promise;
    const { result } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    expect(mockStart).not.toHaveBeenCalled();

    await act(async () => pause.resolve());

    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("keeps the mic closed after a cancel while the player pauses", async () => {
    const pause = deferred();
    mockPaused = pause.promise;
    const { result } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    await act(() => result.current.cancel());

    await act(async () => pause.resolve());

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("stops a mic that was still starting when the session ended", async () => {
    const starting = deferred();
    mockStart.mockReturnValueOnce(starting.promise);
    const { result } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    await act(() => result.current.cancel());
    expect(mockStop).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();

    await act(async () => starting.resolve());

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("a native match transitions to matched, stops the mic and lets the player play", async () => {
    const { result } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    await act(() => mockListeners.match?.(MATCH));
    expect(result.current.status).toBe("matched");
    expect(result.current.match).toEqual(MATCH);
    expect(mockStop).toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledTimes(1);
    // The paused song waits for the sheet to close.
    expect(mockResume).not.toHaveBeenCalled();
  });

  it("plays the paused song on once the mic has stopped, when the session unmounts", async () => {
    const { result, unmount } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    const stop = deferred();
    mockStop.mockReturnValueOnce(stop.promise);

    await unmount();
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockResume).not.toHaveBeenCalled();

    await act(async () => stop.resolve());
    expect(mockResume).toHaveBeenCalledTimes(1);
  });

  it("times out to no_match after 60s of listening", async () => {
    const { result } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    await act(() => jest.advanceTimersByTime(60_000));
    expect(result.current.status).toBe("no_match");
  });

  it("clears the timeout once a match arrives", async () => {
    const { result } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    await act(() => mockListeners.match?.(MATCH));
    await act(() => jest.advanceTimersByTime(60_000));
    // The late timeout must not knock us out of the matched state.
    expect(result.current.status).toBe("matched");
  });

  it("maps a permission error to permission_denied", async () => {
    const { result } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    await act(() =>
      mockListeners.error?.({
        code: "permission",
        message: "Microphone permission denied",
      }),
    );
    expect(result.current.status).toBe("permission_denied");
  });

  it("cancel() stops the mic and resets to idle", async () => {
    const { result } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    await act(() => result.current.cancel());
    expect(result.current.status).toBe("idle");
    expect(mockStop).toHaveBeenCalled();
  });
});
