import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useColors } from "@/hooks/use-colors";

/**
 * The label over a disc's first track, from `discHeadings`. The first one sits
 * under the row above the list, which already leaves room.
 */
export function DiscHeading({
  title,
  first,
}: {
  title: string | null;
  first: boolean;
}) {
  const colors = useColors();
  if (!title) return null;
  return (
    <View style={[styles.row, !first && styles.spaced]}>
      <Ionicons
        name="disc-outline"
        size={14}
        color={colors.subtle}
        // The label says it already.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <SectionLabel style={styles.label}>{title}</SectionLabel>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
  },
  spaced: {
    paddingTop: 20,
  },
  // A long title wraps beside the icon instead of running off the screen.
  label: {
    flexShrink: 1,
  },
});
