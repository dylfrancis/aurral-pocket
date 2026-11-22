import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { PanGestureConfig } from "react-native-gesture-handler";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { next, previous } from "@/lib/player/player";

/** 1 plays the next track, -1 the previous one. */
type SkipDirection = 1 | -1;

type SwipeTrack = {
  id: string;
  coverPath?: string | null;
  artwork: string | null;
};

type SwipeOptions = {
  /** How far the content moves to leave its clipped area. */
  travel: number;
  /** Off, the content rests in place, for when the swiped area is gone. */
  enabled?: boolean;
};

type PendingSkip = {
  direction: SkipDirection;
  fromCover: string | null;
  timer?: ReturnType<typeof setTimeout>;
  /** By this swipe or on its own. */
  trackChanged?: boolean;
  awaitingCover?: boolean;
};

/** A share of the distance the content travels to leave. */
const SKIP_SHARE = 0.3;
/** A narrow area still takes this long a drag to skip. */
const MIN_SKIP_DISTANCE = 48;
/** A flick this fast skips at any length, in points per second. */
const FLICK_VELOCITY = 500;
/**
 * How long the content waits off screen once the skip has gone through.
 * ⏮ restarting the track, or no track up next, leaves the same one playing.
 */
const RETURN_DELAY_MS = 300;
/** How long the new track's cover gets to load before the content comes back. */
const COVER_WAIT_MS = 600;
/** A skip that never settles still brings the content back. */
const MAX_AWAY_MS = 2000;

const SPRING_BACK = { duration: 400, dampingRatio: 1, overshootClamping: true };
const LEAVE = { duration: 250, dampingRatio: 1, overshootClamping: true };
const ENTER = { duration: 400, dampingRatio: 1 };

/**
 * Swipe left to skip ahead, right to go back as ⏮ does. `panConfig` goes on
 * the swiped area, `style` or `offset` on what slides, `onCoverLoad` on its
 * cover image.
 */
export function useSwipeToSkip(
  track: SwipeTrack | null,
  { travel, enabled = true }: SwipeOptions,
) {
  const trackId = track?.id ?? null;
  const cover = coverKey(track);
  const active = enabled && track !== null;
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const sharedTravel = useSharedValue(travel);
  // A second swipe waits until the content is back.
  const isOffScreen = useSharedValue(false);
  const pending = useRef<PendingSkip | null>(null);

  useEffect(() => {
    sharedTravel.set(travel);
  }, [sharedTravel, travel]);

  const comeBack = useCallback(() => {
    const swipe = pending.current;
    if (!swipe) return;
    pending.current = null;
    clearTimeout(swipe.timer);
    // In from the side opposite the one it left by.
    offset.set(
      withSequence(
        withTiming(swipe.direction * sharedTravel.get(), { duration: 0 }),
        withSpring(0, ENTER),
      ),
    );
    isOffScreen.set(false);
  }, [isOffScreen, sharedTravel, offset]);

  const comeBackAfter = useCallback(
    (swipe: PendingSkip, delayMs: number) => {
      clearTimeout(swipe.timer);
      swipe.timer = setTimeout(comeBack, delayMs);
    },
    [comeBack],
  );

  const beginSkip = useCallback(
    (direction: SkipDirection) => {
      clearTimeout(pending.current?.timer);
      pending.current = { direction, fromCover: cover };
    },
    [cover],
  );

  const skipOffScreen = useCallback(
    (direction: SkipDirection) => {
      const swipe = pending.current;
      // The track moved on by itself while the content left, so the skip is off.
      if (!swipe || swipe.trackChanged) return;
      comeBackAfter(swipe, MAX_AWAY_MS);
      void skip(direction).then(() => {
        if (pending.current === swipe && !swipe.trackChanged) {
          comeBackAfter(swipe, RETURN_DELAY_MS);
        }
      });
    },
    [comeBackAfter],
  );

  // A layout effect, so it runs before the new cover can report its load.
  useLayoutEffect(() => {
    const swipe = pending.current;
    if (!swipe) return;
    swipe.trackChanged = true;
    if (cover === null || cover === swipe.fromCover) {
      comeBack();
      return;
    }
    // The old cover stays out of sight until the image swaps to the new one.
    swipe.awaitingCover = true;
    comeBackAfter(swipe, COVER_WAIT_MS);
  }, [trackId, cover, comeBack, comeBackAfter]);

  const onCoverLoad = useCallback(() => {
    if (pending.current?.awaitingCover) comeBack();
  }, [comeBack]);

  // A detector that unmounts mid-drag never reports the release.
  useEffect(() => {
    if (active) return;
    clearTimeout(pending.current?.timer);
    pending.current = null;
    offset.set(0);
    isOffScreen.set(false);
  }, [active, isOffScreen, offset]);

  useEffect(
    () => () => {
      clearTimeout(pending.current?.timer);
      pending.current = null;
    },
    [],
  );

  const panConfig = useMemo<PanGestureConfig>(
    () => ({
      // Sideways only, so the drag down that closes the player still works.
      activeOffsetX: [-12, 12],
      failOffsetY: [-12, 12],
      onActivate: () => {
        "worklet";
        // Mid-spring, the drag starts from where the content is.
        dragStart.set(offset.get());
      },
      onUpdate: (event) => {
        "worklet";
        if (isOffScreen.get()) return;
        offset.set(dragStart.get() + event.translationX);
      },
      onDeactivate: (event) => {
        "worklet";
        if (isOffScreen.get()) return;
        const currentTravel = sharedTravel.get();
        const direction = event.canceled
          ? 0
          : skipDirection(event.translationX, event.velocityX, currentTravel);
        if (direction === 0) {
          offset.set(
            withSpring(0, { ...SPRING_BACK, velocity: event.velocityX }),
          );
          return;
        }
        if (reduceMotion) {
          offset.set(0);
          scheduleOnRN(skip, direction);
          return;
        }
        isOffScreen.set(true);
        scheduleOnRN(beginSkip, direction);
        offset.set(
          withSpring(
            -direction * currentTravel,
            { ...LEAVE, velocity: event.velocityX },
            (finished) => {
              "worklet";
              // Cut short, whatever stopped it brings the content back.
              if (finished) scheduleOnRN(skipOffScreen, direction);
            },
          ),
        );
      },
    }),
    [
      isOffScreen,
      beginSkip,
      sharedTravel,
      dragStart,
      offset,
      reduceMotion,
      skipOffScreen,
    ],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() }],
  }));

  return { panConfig, offset, style, onCoverLoad };
}

/** Never rejects: a failed skip leaves the track on, like a restart. */
function skip(direction: SkipDirection): Promise<void> {
  return (direction === 1 ? next() : previous()).catch(() => {});
}

/** What the artwork loads. An album's tracks share it, so the content needn't wait. */
function coverKey(track: SwipeTrack | null): string | null {
  if (!track?.coverPath && !track?.artwork) return null;
  return `${track.coverPath ?? ""}\n${track.artwork ?? ""}`;
}

/** Where a released drag goes: 0 springs back. */
function skipDirection(
  translation: number,
  velocity: number,
  travel: number,
): SkipDirection | 0 {
  "worklet";
  if (Math.abs(velocity) > FLICK_VELOCITY) {
    // A flick back toward the start calls the skip off.
    if (Math.sign(velocity) !== Math.sign(translation)) return 0;
  } else if (
    Math.abs(translation) < Math.max(travel * SKIP_SHARE, MIN_SKIP_DISTANCE)
  ) {
    return 0;
  }
  // Left is forward.
  return translation < 0 ? 1 : -1;
}
