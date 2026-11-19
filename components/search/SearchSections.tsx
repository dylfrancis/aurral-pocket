import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

/** The uppercase heading over a group of search results. */
export function SearchSectionLabel({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text
      variant="caption"
      accessibilityRole="header"
      style={[styles.sectionLabel, { color: colors.subtle }]}
    >
      {text}
    </Text>
  );
}

/** The forward chevron opens a screen; the down chevron expands in place. */
export function SeeAllRow({
  label,
  icon = "chevron-forward",
  onPress,
}: {
  label: string;
  icon?: "chevron-forward" | "chevron-down";
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.seeAllRow,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text variant="body" style={[styles.seeAllText, { color: colors.brand }]}>
        {label}
      </Text>
      <Ionicons name={icon} size={16} color={colors.brand} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  seeAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 4,
  },
  seeAllText: {
    ...Fonts.semiBold,
  },
});
