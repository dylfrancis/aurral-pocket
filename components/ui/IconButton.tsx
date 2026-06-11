import { IS_IOS } from "@/constants/platform";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Platform, Pressable, StyleSheet } from "react-native";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  /** Diameter of the circular button. Defaults to 40 (glass) / 36 (fallback). */
  size?: number;
  tintColor?: string;
  fallbackBackground?: string;
};

/**
 * Round icon-only action button. Uses the iOS glass effect when available,
 * otherwise a circular pressable on a neutral background.
 */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size,
  tintColor,
  fallbackBackground,
}: Props) {
  const colors = Colors[useColorScheme()];
  const iconColor = tintColor ?? colors.text;
  const background = fallbackBackground ?? colors.inputBackground;

  if (IS_IOS && isGlassEffectAPIAvailable()) {
    const diameter = size ?? 40;
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        tintColor={tintColor}
        style={[
          styles.glass,
          { width: diameter, height: diameter, borderRadius: diameter / 2 },
        ]}
      >
        <Pressable
          onPress={onPress}
          hitSlop={12}
          style={styles.inner}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Ionicons name={icon} size={22} color={iconColor} />
        </Pressable>
      </GlassView>
    );
  }

  const diameter = size ?? 36;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      android_ripple={{
        color: iconColor,
        borderless: true,
        radius: diameter / 2 + 2,
      }}
      style={({ pressed }) => [
        styles.fallback,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor:
            Platform.OS === "android" ? "transparent" : background,
          opacity: Platform.OS === "ios" && pressed ? 0.6 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glass: {
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
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
