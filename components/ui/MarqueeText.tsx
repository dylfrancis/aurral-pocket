import { useState, type ComponentProps } from "react";
import { StyleSheet, View, type StyleProp, type TextStyle } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { Text } from "@/components/ui/Text";

const COPY_GAP = 48;
const POINTS_PER_SECOND = 30;
const START_PAUSE_MS = 2500;

const HIDDEN_FROM_ACCESSIBILITY = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

type MarqueeTextProps = {
  children: string;
  variant?: ComponentProps<typeof Text>["variant"];
  style?: StyleProp<TextStyle>;
  align?: "center" | "start";
};

/**
 * One line that scrolls sideways when it doesn't fit, with a copy trailing
 * behind so the loop has no seam. With reduced motion it truncates instead.
 */
export function MarqueeText({
  children,
  variant,
  style,
  align = "start",
}: MarqueeTextProps) {
  const reduceMotion = useReducedMotion();
  const [lineWidth, setLineWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const shouldScroll = !reduceMotion && lineWidth > 0 && textWidth > lineWidth;

  // Explicit widths keep each copy on one line inside a track wider than the
  // line itself.
  const copyWidth = Math.ceil(textWidth);
  const loopDistance = copyWidth + COPY_GAP;
  const loopDuration =
    START_PAUSE_MS + (loopDistance / POINTS_PER_SECOND) * 1000;
  const pauseEnd = `${((START_PAUSE_MS / loopDuration) * 100).toFixed(2)}%`;

  return (
    <View
      style={styles.line}
      onLayout={(event) => setLineWidth(event.nativeEvent.layout.width)}
    >
      <View style={styles.measurer} {...HIDDEN_FROM_ACCESSIBILITY}>
        <Text
          variant={variant}
          style={style}
          numberOfLines={1}
          onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
        >
          {children}
        </Text>
      </View>
      {shouldScroll ? (
        <Animated.View
          style={[
            styles.track,
            {
              width: loopDistance + copyWidth,
              animationName: {
                from: { transform: [{ translateX: 0 }] },
                [pauseEnd]: { transform: [{ translateX: 0 }] },
                to: { transform: [{ translateX: -loopDistance }] },
              },
              animationDuration: loopDuration,
              animationIterationCount: "infinite",
              animationTimingFunction: "linear",
            },
          ]}
        >
          <Text
            variant={variant}
            style={[style, { width: copyWidth }]}
            numberOfLines={1}
          >
            {children}
          </Text>
          <Text
            variant={variant}
            style={[style, { width: copyWidth, marginLeft: COPY_GAP }]}
            numberOfLines={1}
            {...HIDDEN_FROM_ACCESSIBILITY}
          >
            {children}
          </Text>
        </Animated.View>
      ) : (
        <Text
          variant={variant}
          style={[style, align === "center" && styles.centered]}
          numberOfLines={1}
        >
          {children}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    alignSelf: "stretch",
    overflow: "hidden",
  },
  // Out of the flow and unbounded, so the text takes its natural width.
  measurer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 10000,
    flexDirection: "row",
    opacity: 0,
  },
  track: {
    flexDirection: "row",
  },
  centered: {
    textAlign: "center",
  },
});
