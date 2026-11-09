import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import type { PanGestureConfig } from "react-native-gesture-handler";
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/** A share of the screen's height. */
const CLOSE_THRESHOLD = 0.3;
const DRAG_CORNER_RADIUS = 32;
const BACKDROP_OPACITY = 0.4;

/**
 * Pass `panConfig` to `usePanGesture` once per area that should drag; keep a
 * scrolling list outside them.
 */
export function useDragToClose(onClose: () => void) {
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const dragStart = useSharedValue(0);

  const panConfig = useMemo<PanGestureConfig>(
    () => ({
      // Downward only, and never from a sideways drag on the scrubber.
      activeOffsetY: 10,
      failOffsetX: [-20, 20],
      onActivate: () => {
        "worklet";
        // Mid-spring, the drag starts from where the sheet is.
        dragStart.set(translateY.get());
      },
      onUpdate: (event) => {
        "worklet";
        const next = dragStart.get() + event.translationY;
        translateY.set(next >= 0 ? next : rubberband(next, height));
      },
      onDeactivate: (event) => {
        "worklet";
        const projected = translateY.get() + project(event.velocityY);
        if (!event.canceled && projected > height * CLOSE_THRESHOLD) {
          translateY.set(
            withSpring(
              height,
              {
                duration: 300,
                dampingRatio: 1,
                velocity: event.velocityY,
                overshootClamping: true,
              },
              (finished) => {
                "worklet";
                if (finished) scheduleOnRN(onClose);
              },
            ),
          );
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
    [dragStart, height, onClose, translateY],
  );

  const sheetStyle = useAnimatedStyle(() => {
    const radius = interpolate(
      translateY.get(),
      [0, 80],
      [0, DRAG_CORNER_RADIUS],
      Extrapolation.CLAMP,
    );
    return {
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
      transform: [{ translateY: translateY.get() }],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.get(),
      [0, height],
      [BACKDROP_OPACITY, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return { panConfig, sheetStyle, backdropStyle };
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
