import { useCallback, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import type { PanGestureConfig } from "react-native-gesture-handler";
import {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/** A share of the screen's height. */
const CLOSE_THRESHOLD = 0.3;
const DRAG_CORNER_RADIUS = 32;
const BACKDROP_OPACITY = 0.4;
const LEAVE_SPRING = {
  duration: 300,
  dampingRatio: 1,
  overshootClamping: true,
};
const ENTER_SPRING = {
  duration: 450,
  dampingRatio: 1,
  overshootClamping: true,
};
/** How small the sheet gets as it closes into `collapseTo`. */
const COLLAPSED_SCALE = 0.15;
/** How far through `dismissal` a collapsing sheet has faded out. */
const SHEET_GONE_AT = 0.75;

type Point = { x: number; y: number };

type DragToCloseOptions = {
  /** The sheet waits below the screen for `enter` instead of the route animating it in. */
  startBelow?: boolean;
  /**
   * A point on screen the sheet shrinks into as it leaves and grows out of as
   * it enters, instead of sliding.
   */
  collapseTo?: SharedValue<Point | null>;
};

/**
 * Pass `panConfig` to `usePanGesture` once per area that should drag; keep a
 * scrolling list outside them.
 *
 * `dismissal` runs from 0 (up) to 1 (gone) as the sheet enters or leaves on
 * its own, but not while a finger drags it, so a view can travel somewhere
 * else as the sheet goes.
 */
export function useDragToClose(
  onClose: () => void,
  { startBelow = false, collapseTo }: DragToCloseOptions = {},
) {
  const { width, height } = useWindowDimensions();
  const translateY = useSharedValue(startBelow ? height : 0);
  const dismissal = useSharedValue(startBelow ? 1 : 0);
  // A drag that starts while the sheet moves on its own is ignored, so it
  // can't strand the sheet halfway with `dismissal` at its end.
  const settling = useSharedValue(startBelow);
  const leaving = useSharedValue(false);
  const ignoringDrag = useSharedValue(false);
  const dragStart = useSharedValue(0);

  const enter = useCallback(() => {
    const settled = (finished?: boolean) => {
      "worklet";
      if (finished) settling.set(false);
    };
    if (collapseTo?.get()) {
      translateY.set(0);
      dismissal.set(withSpring(0, ENTER_SPRING, settled));
      return;
    }
    translateY.set(withSpring(0, ENTER_SPRING, settled));
    dismissal.set(withSpring(0, ENTER_SPRING));
  }, [collapseTo, dismissal, settling, translateY]);

  /** Sends the sheet away, then calls `onLeft`. Later calls while it goes are dropped. */
  const leave = useCallback(
    (onLeft: () => void, velocity = 0) => {
      "worklet";
      if (leaving.get()) return;
      leaving.set(true);
      settling.set(true);
      const arrived = (finished?: boolean) => {
        "worklet";
        if (finished) scheduleOnRN(onLeft);
      };
      // Collapsing starts from where the drag let go, so the sheet stays put.
      if (collapseTo?.get()) {
        dismissal.set(withSpring(1, LEAVE_SPRING, arrived));
        return;
      }
      translateY.set(
        withSpring(height, { ...LEAVE_SPRING, velocity }, arrived),
      );
      dismissal.set(withSpring(1, LEAVE_SPRING));
    },
    [collapseTo, dismissal, height, leaving, settling, translateY],
  );

  const panConfig = useMemo<PanGestureConfig>(
    () => ({
      // Downward only, and never from a sideways drag on the scrubber.
      activeOffsetY: 10,
      failOffsetX: [-20, 20],
      onActivate: () => {
        "worklet";
        ignoringDrag.set(settling.get());
        // Mid-spring, the drag starts from where the sheet is.
        dragStart.set(translateY.get());
      },
      onUpdate: (event) => {
        "worklet";
        if (ignoringDrag.get()) return;
        const next = dragStart.get() + event.translationY;
        translateY.set(next >= 0 ? next : rubberband(next, height));
      },
      onDeactivate: (event) => {
        "worklet";
        if (ignoringDrag.get()) return;
        const projected = translateY.get() + project(event.velocityY);
        if (!event.canceled && projected > height * CLOSE_THRESHOLD) {
          leave(onClose, event.velocityY);
          return;
        }
        // Clamped: an overshoot past the top would open a gap at the bottom.
        translateY.set(
          withSpring(0, {
            duration: 400,
            dampingRatio: 1,
            velocity: event.velocityY,
            overshootClamping: true,
          }),
        );
      },
    }),
    [dragStart, height, ignoringDrag, leave, onClose, settling, translateY],
  );

  // Both branches set the same props: a prop one stops setting keeps its
  // last value.
  const sheetStyle = useAnimatedStyle(() => {
    const point = collapseTo?.get();
    const progress = dismissal.get();
    if (point && progress > 0) {
      const scale = 1 + (COLLAPSED_SCALE - 1) * progress;
      // From where the drag let go, every part of the sheet closes in on
      // `point`.
      const offset = translateY.get() * (1 - progress);
      // The corner scales with the sheet, so it is set pre-scale.
      const radius = DRAG_CORNER_RADIUS / scale;
      return {
        opacity: interpolate(
          progress,
          [0, SHEET_GONE_AT],
          [1, 0],
          Extrapolation.CLAMP,
        ),
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: radius,
        // Scaling pivots on the sheet's center; this moves the pivot to
        // `point`.
        transform: [
          { translateX: (1 - scale) * (point.x - width / 2) },
          {
            translateY: (1 - scale) * (point.y - height / 2) + scale * offset,
          },
          { scale },
        ],
      };
    }
    const radius = interpolate(
      translateY.get(),
      [0, 80],
      [0, DRAG_CORNER_RADIUS],
      Extrapolation.CLAMP,
    );
    return {
      opacity: 1,
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      transform: [
        { translateX: 0 },
        { translateY: translateY.get() },
        { scale: 1 },
      ],
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    const collapsed = collapseTo?.get() ? dismissal.get() : 0;
    return {
      opacity:
        interpolate(
          translateY.get(),
          [0, height],
          [BACKDROP_OPACITY, 0],
          Extrapolation.CLAMP,
        ) *
        (1 - collapsed),
    };
  });

  return {
    panConfig,
    sheetStyle,
    backdropStyle,
    translateY,
    dismissal,
    enter,
    leave,
  };
}

/** Where a flick would come to rest, by Apple's decay rate. */
function project(velocity: number, decelerationRate = 0.998): number {
  "worklet";
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** The further past the edge, the less the sheet follows. */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  "worklet";
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  );
}
