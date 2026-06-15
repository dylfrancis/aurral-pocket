import { act, renderHook } from "@testing-library/react-native";

type Listener = ((arg?: any) => void) | null;
const mockListeners: { match: Listener; noMatch: Listener; error: Listener } = {
  match: null,
  noMatch: null,
  error: null,
};
const mockStart = jest.fn((_token: string | null) => Promise.resolve());
const mockStop = jest.fn(() => Promise.resolve());

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

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockListeners.match = null;
  mockListeners.noMatch = null;
  mockListeners.error = null;
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

  it("a native match transitions to matched and stops the mic", async () => {
    const { result } = await renderHook(() => useShazam());
    await act(() => result.current.start());
    await act(() => mockListeners.match?.(MATCH));
    expect(result.current.status).toBe("matched");
    expect(result.current.match).toEqual(MATCH);
    expect(mockStop).toHaveBeenCalled();
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
