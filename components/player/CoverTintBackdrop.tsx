import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const TINT_TRANSITION = {
  transitionProperty: "backgroundColor",
  transitionDuration: 400,
  transitionTimingFunction: "ease-in-out",
} as const;

type CoverTintBackdropProps = {
  /** From useCoverTint. */
  tint: string;
  /** Where the fade into the background starts and ends, as fractions of the backdrop's height. */
  fadeStops: readonly [number, number];
  /** Paints the tint this far above the backdrop, so content pulled past its top shows no seam. */
  bleed?: number;
  /** Eases into a new tint rather than switching at once. */
  animated?: boolean;
};

/**
 * The cover's color behind artwork, fading into the scheme's background.
 * Fills its parent and takes no touches.
 */
export function CoverTintBackdrop({
  tint,
  fadeStops,
  bleed = 0,
  animated = true,
}: CoverTintBackdropProps) {
  const background = Colors[useColorScheme()].background;

  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
      <Animated.View
        style={[
          styles.fill,
          { top: -bleed, backgroundColor: tint },
          animated && TINT_TRANSITION,
        ]}
      />
      <LinearGradient
        colors={[`${background}00`, background]}
        locations={fadeStops}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  passThrough: {
    pointerEvents: "none",
  },
  fill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
