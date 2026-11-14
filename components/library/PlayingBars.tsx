import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const BAR_MIN = 3;
const BAR_MAX = 12;
/** Staggered so the three bars never move in lockstep. */
const BAR_DURATIONS = [420, 520, 360];

/**
 * The three-bar equaliser that marks the track the player is on. Paused
 * holds the bars still at their resting height rather than hiding them, so a
 * paused track still reads as the current one.
 */
export function PlayingBars({
  animating,
  color,
}: {
  animating: boolean;
  color: string;
}) {
  return (
    <View style={styles.bars} testID="track-playing-indicator">
      {BAR_DURATIONS.map((duration, index) => (
        <Bar
          key={index}
          duration={duration}
          delay={index * 110}
          animating={animating}
          color={color}
        />
      ))}
    </View>
  );
}

function Bar({
  duration,
  delay,
  animating,
  color,
}: {
  duration: number;
  delay: number;
  animating: boolean;
  color: string;
}) {
  const height = useSharedValue(BAR_MIN);
  // Respecting the OS setting matters more than the flourish: this animation
  // never stops on its own, so it would loop for as long as the page is open.
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!animating || reduceMotion) {
      cancelAnimation(height);
      height.value = withTiming(reduceMotion && animating ? BAR_MAX : BAR_MIN, {
        duration: 150,
      });
      return;
    }
    height.value = withDelay(
      delay,
      withRepeat(withTiming(BAR_MAX, { duration }), -1, true),
    );
    return () => cancelAnimation(height);
  }, [animating, reduceMotion, duration, delay, height]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: color }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: BAR_MAX,
    gap: 2,
  },
  bar: {
    width: 2.5,
    borderRadius: 1.5,
  },
});
