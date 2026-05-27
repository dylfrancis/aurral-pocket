import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const SIZE = 96;

/** Pulsing ring + mic icon shown while a listening session is active. */
export function ShazamListeningIndicator() {
  const colors = Colors[useColorScheme()];
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.6 }],
    opacity: 0.5 * (1 - pulse.value),
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.ring, { backgroundColor: colors.brand }, ringStyle]}
      />
      <View style={[styles.core, { backgroundColor: colors.brand }]}>
        <Ionicons name="mic" size={36} color="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE * 2,
    height: SIZE * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  core: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
