import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type BlockedChipProps = {
  label: string;
  onRemove: () => void;
  accessibilityLabel?: string;
};

export function BlockedChip({
  label,
  onRemove,
  accessibilityLabel,
}: BlockedChipProps) {
  const colors = Colors[useColorScheme()];
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: colors.card, borderColor: colors.separator },
      ]}
    >
      <Text
        variant="caption"
        style={[styles.label, { color: colors.text, fontFamily: Fonts.medium }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `Remove ${label}`}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Ionicons name="close-circle" size={16} color={colors.subtle} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "100%",
  },
  label: {
    fontSize: 13,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.5,
  },
});
