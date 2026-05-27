import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { addLevelListener } from "@/modules/shazam";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const SIZE = 96;

/**
 * Ring + mic icon shown while listening. The ring scale/opacity track the live
 * microphone level (via the native `onLevel` events); a gentle idle breathing
 * animation keeps it alive when it's quiet.
 */
export function ShazamListeningIndicator() {
  const colors = Colors[useColorScheme()];
  const level = useSharedValue(0);
  const idle = useSharedValue(0);

  useEffect(() => {
    idle.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(idle);
  }, [idle]);

  useEffect(() => {
    const sub = addLevelListener((value) => {
      level.value = withTiming(value, { duration: 90 });
    });
    return () => sub?.remove();
  }, [level]);

  const ringStyle = useAnimatedStyle(() => {
    const energy = idle.value * 0.2 + level.value * 0.8;
    return {
      transform: [{ scale: 1 + energy * 0.7 }],
      opacity: 0.12 + energy * 0.4,
    };
  });

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
