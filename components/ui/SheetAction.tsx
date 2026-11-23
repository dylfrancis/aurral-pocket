import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColors } from "@/hooks/use-colors";

/** One row of an actions sheet: an icon and what it does. */
export function SheetAction({
  icon,
  label,
  onPress,
  disabled = false,
  destructive = false,
  checked = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Marks a setting that's on, which a tap turns off. */
  checked?: boolean;
}) {
  const colors = useColors();
  const color = disabled
    ? colors.subtle
    : destructive
      ? colors.error
      : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      // Read out as selected, as a ticked item in a native menu is.
      accessibilityState={{ disabled, selected: checked || undefined }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text variant="body" style={[styles.label, { color }]}>
        {label}
      </Text>
      {checked ? (
        <Ionicons name="checkmark" size={20} color={colors.brand} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  label: {
    flex: 1,
  },
});
