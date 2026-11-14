import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

const MIN_TAP_SIZE = 44;
const ICON_SIZE_RATIO = 0.48;

type CircleButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
};

/** A flat round icon button for actions in a page's content. */
export function CircleButton({
  icon,
  size,
  accessibilityLabel,
  onPress,
  disabled,
}: CircleButtonProps) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      hitSlop={Math.max(0, (MIN_TAP_SIZE - size) / 2)}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceMid,
          opacity: disabled ? 0.5 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={Math.round(size * ICON_SIZE_RATIO)}
        color={colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
});
