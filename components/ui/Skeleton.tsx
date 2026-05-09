import { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

type SkeletonProps = {
  width: number | "100%";
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

const SHIMMER_BAND_RATIO = 0.6;
const SHIMMER_DURATION_MS = 1100;

export function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const progress = useSharedValue(0);
  const [measured, setMeasured] = useState<number>(
    typeof width === "number" ? width : 0,
  );

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION_MS }),
      -1,
      false,
    );
  }, [progress]);

  const handleLayout = (event: LayoutChangeEvent) => {
    if (typeof width !== "number") {
      setMeasured(event.nativeEvent.layout.width);
    }
  };

  const bandWidth = measured * SHIMMER_BAND_RATIO;
  const startX = -bandWidth;
  const endX = measured;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startX + (endX - startX) * progress.value }],
  }));

  const highlight =
    scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.base,
        { width, height, borderRadius, backgroundColor: colors.separator },
        style,
      ]}
    >
      {measured > 0 && (
        <Animated.View
          style={[
            styles.shimmer,
            { width: bandWidth, height: "100%" },
            animatedStyle,
          ]}
        >
          <LinearGradient
            colors={["transparent", highlight, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
