import { IS_IOS } from "@/constants/platform";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Platform, Pressable, StyleSheet } from "react-native";

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
  tintColor?: string;
  fallbackBackground?: string;
};

export function CloseButton({
  onPress,
  accessibilityLabel = "Close",
  tintColor,
  fallbackBackground,
}: Props) {
  const colors = Colors[useColorScheme()];
  const icon = tintColor ?? colors.text;
  const background = fallbackBackground ?? colors.inputBackground;

  if (IS_IOS && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        tintColor={tintColor}
        style={styles.glass}
      >
        <Pressable
          onPress={onPress}
          hitSlop={12}
          style={styles.inner}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Ionicons name="close" size={22} color={icon} />
        </Pressable>
      </GlassView>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      android_ripple={{ color: icon, borderless: true, radius: 20 }}
      style={({ pressed }) => [
        styles.fallback,
        {
          backgroundColor:
            Platform.OS === "android" ? "transparent" : background,
          opacity: Platform.OS === "ios" && pressed ? 0.6 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="close" size={18} color={icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
