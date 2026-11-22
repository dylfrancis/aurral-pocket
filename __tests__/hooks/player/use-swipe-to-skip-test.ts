// Animations jump to their target. A spring's end waits in `mockLandings`
// until the test lets it land, so a test can act while the content moves.
let mockReducedMotion = false;
const mockLandings: ((finished: boolean) => void)[] = [];
jest.mock("react-native-reanimated", () => {
  const { useRef } = require("react");
  return {
    useReducedMotion: () => mockReducedMotion,
    useSharedValue: (initial: unknown) => {
      const ref = useRef(null);
      if (ref.current === null) {
        let current = initial;
        ref.current = {
          get: () => current,
          set: (next: unknown) => (current = next),
        };
      }
      return ref.current;
    },
    useAnimatedStyle: (fn: () => object) => fn(),
    withSpring: (
      target: number,
      _config: unknown,
      onLand?: (finished: boolean) => void,
    ) => {
      if (onLand) mockLandings.push(onLand);
      return target;
    },
    withTiming: (target: number) => target,
    withSequence: (...steps: number[]) => steps[steps.length - 1],
  };
});
jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) =>
    fn(...args),
}));

const mockNext = jest.fn((): Promise<void> => Promise.resolve());
const mockPrevious = jest.fn((): Promise<void> => Promise.resolve());
jest.mock("@/lib/player/player", () => ({
  next: () => mockNext(),
  previous: () => mockPrevious(),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useSwipeToSkip } from "@/hooks/player/use-swipe-to-skip";

type Track = { id: string; coverPath: string | null; artwork: string | null };
type Props = { track: Track; enabled?: boolean };
type Gesture = { translationX: number; velocityX?: number; canceled?: boolean };
type Handler = (event: Gesture) => void;

const SCREEN = 390;
const KID_A = { coverPath: "/covers/kid-a.jpg", artwork: null };
const AMNESIAC = { coverPath: "/covers/amnesiac.jpg", artwork: null };
const playing: Track = { id: "track-1", ...KID_A };

async function renderSwipe(travel = SCREEN) {
  const utils = await renderHook(
    ({ track, enabled }: Props) => useSwipeToSkip(track, { travel, enabled }),
    { initialProps: { track: playing } as Props },
  );
  const handlers = () =>
    utils.result.current.panConfig as unknown as Record<
      "onActivate" | "onUpdate" | "onDeactivate",
      Handler
    >;
  const drag = async (translationX: number) => {
    await act(async () => {
      handlers().onActivate({ translationX });
      handlers().onUpdate({ translationX });
    });
  };
  // Released, and let land unless the test holds the content mid-move.
  const swipe = async (
    { translationX, velocityX = 0, canceled = false }: Gesture,
    { land = true } = {},
  ) => {
    await drag(translationX);
    await act(async () => {
      handlers().onDeactivate({ translationX, velocityX, canceled });
    });
    if (land) await landAll();
  };
  const landAll = () =>
    act(async () => {
      for (const onLand of mockLandings.splice(0)) onLand(true);
    });
  const offset = () => utils.result.current.offset.get();
  const showTrack = (track: Track) => act(() => utils.rerender({ track }));
  return { ...utils, drag, swipe, landAll, offset, showTrack };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLandings.length = 0;
  mockReducedMotion = false;
});

describe("useSwipeToSkip", () => {
  it.each([
    ["a drag left past a third of the way", { translationX: -150 }, "next"],
    ["a drag right past a third of the way", { translationX: 150 }, "previous"],
    ["a short flick left", { translationX: -30, velocityX: -800 }, "next"],
    ["a short flick right", { translationX: 30, velocityX: 800 }, "previous"],
    ["a short drag", { translationX: -100, velocityX: -100 }, null],
    [
      "a flick back toward the start",
      { translationX: -150, velocityX: 800 },
      null,
    ],
    [
      "a drag another gesture took over",
      { translationX: -150, canceled: true },
      null,
    ],
  ] as const)("on %s, skips to %s", async (_name, gesture, skip) => {
    const { swipe, offset } = await renderSwipe();

    await swipe(gesture);

    expect(mockNext).toHaveBeenCalledTimes(skip === "next" ? 1 : 0);
    expect(mockPrevious).toHaveBeenCalledTimes(skip === "previous" ? 1 : 0);
    if (skip === null) expect(offset()).toBe(0);
  });

  it("needs a longer drag than a third of a narrow area", async () => {
    const { swipe } = await renderSwipe(44);

    await swipe({ translationX: -40 });
    expect(mockNext).not.toHaveBeenCalled();

    await swipe({ translationX: -50 });
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("waits off screen for the new track's cover, ignoring another swipe, then comes back", async () => {
    const { result, swipe, offset, showTrack } = await renderSwipe();

    await swipe({ translationX: -150 });
    expect(offset()).toBe(-SCREEN);

    await swipe({ translationX: -150 });
    expect(mockNext).toHaveBeenCalledTimes(1);

    await showTrack({ id: "track-2", ...AMNESIAC });
    expect(offset()).toBe(-SCREEN);

    await act(async () => result.current.onCoverLoad());
    expect(offset()).toBe(0);
  });

  it("comes straight back when the new track has the same cover", async () => {
    const { swipe, offset, showTrack } = await renderSwipe();

    await swipe({ translationX: -150 });
    await showTrack({ id: "track-2", ...KID_A });

    expect(offset()).toBe(0);
  });

  describe("on a timer", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("comes back without the new cover when it is slow to load", async () => {
      const { swipe, offset, showTrack } = await renderSwipe();

      await swipe({ translationX: -150 });
      await showTrack({ id: "track-2", ...AMNESIAC });
      await act(() => jest.advanceTimersByTime(550));
      expect(offset()).toBe(-SCREEN);

      await act(() => jest.advanceTimersByTime(100));
      expect(offset()).toBe(0);
    });

    it("comes back when the skip leaves the same track playing", async () => {
      // ⏮ 3 s into a track only starts it over.
      const { swipe, offset } = await renderSwipe();

      await swipe({ translationX: 150 });
      expect(offset()).toBe(SCREEN);

      await act(() => jest.advanceTimersByTime(250));
      expect(offset()).toBe(SCREEN);

      await act(() => jest.advanceTimersByTime(100));
      expect(offset()).toBe(0);
    });

    it("waits for a slow skip, but not for good", async () => {
      mockNext.mockReturnValueOnce(new Promise<void>(() => {}));
      const { swipe, offset } = await renderSwipe();

      await swipe({ translationX: -150 });
      await act(() => jest.advanceTimersByTime(1500));
      expect(offset()).toBe(-SCREEN);

      await act(() => jest.advanceTimersByTime(600));
      expect(offset()).toBe(0);
    });
  });

  it("calls the skip off when the track moves on by itself as the content leaves", async () => {
    const { result, swipe, landAll, offset, showTrack } = await renderSwipe();

    await swipe({ translationX: -150 }, { land: false });
    await showTrack({ id: "track-2", ...AMNESIAC });
    await landAll();
    expect(mockNext).not.toHaveBeenCalled();

    await act(async () => result.current.onCoverLoad());
    expect(offset()).toBe(0);
  });

  it("with reduced motion, skips in place", async () => {
    mockReducedMotion = true;
    const { swipe, offset } = await renderSwipe();

    await swipe({ translationX: -150 });

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(offset()).toBe(0);
  });

  it("rests in place when the swiped area goes away mid-drag", async () => {
    const { drag, offset, rerender } = await renderSwipe();

    await drag(-100);
    expect(offset()).toBe(-100);

    await act(() => rerender({ track: playing, enabled: false }));
    expect(offset()).toBe(0);
  });
});
