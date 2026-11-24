// Adapted from DiaText in reacticx (github.com/rit3zh/reacticx), MIT © rit3zh.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactElement,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import MaskedViewClass from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";

// Its typings declare a class TypeScript 6 doesn't read as a React component.
const MaskedView = MaskedViewClass as unknown as ComponentType<
  ViewProps & { maskElement: ReactElement }
>;

/**
 * The middle of the band, a glint between two `brandStrong` edges. Both come
 * from the Tailwind lime scale behind the brand tokens: paler limes stand out
 * on dark, deeper ones on light.
 */
const GLINT = {
  dark: ["#d9f99d", "#f7fee7", "#d9f99d"],
  light: ["#3f6212", "#365314", "#3f6212"],
} as const;
const SWEEP_DURATION = 1500;
const SWEEP_EASING = Easing.inOut(Easing.cubic);
/** The band's width as a share of the word's. */
const BAND_RATIO = 0.34;
/** How long a word stays once the band has passed, before the next takes over. */
const HOLD_DURATION = 1600;
const SWAP_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const EXIT_DURATION = 260;
const ENTER_DURATION = 380;
const SWAP_SHIFT = 12;

const HIDDEN_FROM_ACCESSIBILITY = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

type DiaTextProps = {
  /** Shown in turn, each swept in by the band. A single word sweeps in once. */
  words: readonly string[];
  /** The colour a word is left in once the band has passed. Defaults to `brand`. */
  color?: string;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

/**
 * A lime band sweeps across a word and leaves it in `color`, then the word
 * slides out for the next. With reduced motion it shows the first word, still.
 */
export function DiaText({ words, color, textStyle, style }: DiaTextProps) {
  const reduceMotion = useReducedMotion();
  const scheme = useColorScheme();
  const colors = useColors();
  const tint = color ?? colors.brand;
  const rotates = words.length > 1;

  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ready = size.width > 0;
  const band = size.width * BAND_RATIO;

  const progress = useSharedValue(0);
  const opacity = useSharedValue(rotates ? 0 : 1);
  const shift = useSharedValue(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
        ? prev
        : { width, height },
    );
  }, []);

  const showNext = useCallback(() => setIndex((current) => current + 1), []);

  const holdThenLeave = useCallback(() => {
    holdTimer.current = setTimeout(() => {
      const timing = { duration: EXIT_DURATION, easing: SWAP_EASING };
      opacity.set(withTiming(0, timing));
      shift.set(
        withTiming(-SWAP_SHIFT, timing, (finished) => {
          "worklet";
          if (finished) scheduleOnRN(showNext);
        }),
      );
    }, HOLD_DURATION);
  }, [opacity, shift, showNext]);

  useEffect(() => {
    if (!ready || reduceMotion) return;

    if (rotates) {
      const timing = { duration: ENTER_DURATION, easing: SWAP_EASING };
      shift.set(SWAP_SHIFT);
      shift.set(withTiming(0, timing));
      opacity.set(0);
      opacity.set(withTiming(1, timing));
    }

    progress.set(0);
    progress.set(
      withTiming(
        1,
        { duration: SWEEP_DURATION, easing: SWEEP_EASING },
        (finished) => {
          "worklet";
          if (finished && rotates) scheduleOnRN(holdThenLeave);
        },
      ),
    );
  }, [
    ready,
    reduceMotion,
    index,
    rotates,
    progress,
    opacity,
    shift,
    holdThenLeave,
  ]);

  // A cancelled animation reports unfinished, so nothing is queued after unmount.
  useEffect(
    () => () => {
      clearTimeout(holdTimer.current);
      cancelAnimation(progress);
      cancelAnimation(opacity);
      cancelAnimation(shift);
    },
    [progress, opacity, shift],
  );

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(size.width + band) * (1 - progress.get()) }],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: shift.get() }],
  }));

  if (reduceMotion) {
    return (
      <View style={style}>
        <Text numberOfLines={1} style={[textStyle, { color: tint }]}>
          {words[0]}
        </Text>
      </View>
    );
  }

  const word = words[index % words.length] ?? "";
  const gradient = sweepGradient(size.width, band, tint, [
    colors.brandStrong,
    ...GLINT[scheme],
    colors.brandStrong,
  ]);

  return (
    <View style={style}>
      <Text
        numberOfLines={1}
        onLayout={onLayout}
        style={[textStyle, styles.sizer]}
      >
        {word}
      </Text>
      {ready ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, wordStyle]}
          {...HIDDEN_FROM_ACCESSIBILITY}
        >
          <MaskedView
            style={size}
            maskElement={
              <Text numberOfLines={1} style={[textStyle, styles.mask]}>
                {word}
              </Text>
            }
          >
            <Animated.View
              style={[
                { width: size.width * 2 + band, height: size.height },
                stripStyle,
              ]}
            >
              <LinearGradient
                colors={gradient.colors}
                locations={gradient.locations}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </MaskedView>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * A strip twice the word's width plus the band: `tint`, then the band, then
 * clear. Sliding it right across the word leaves the word in `tint`.
 */
function sweepGradient(
  width: number,
  band: number,
  tint: string,
  sweep: readonly string[],
) {
  const total = width * 2 + band;
  const bandStart = width / total;
  const bandEnd = (width + band) / total;
  const step = (bandEnd - bandStart) / (sweep.length - 1);
  return {
    colors: [tint, tint, ...sweep, "transparent", "transparent"],
    locations: [
      0,
      bandStart,
      ...sweep.map((_, i) => bandStart + i * step),
      bandEnd,
      1,
    ],
  } as const;
}

const styles = StyleSheet.create({
  sizer: {
    opacity: 0,
  },
  mask: {
    color: "#000000",
    backgroundColor: "transparent",
  },
});
