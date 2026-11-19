import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

type SectionHeaderProps = {
  title: string;
  accent?: ReactNode;
  count?: number;
  trailing?: ReactNode;
  onNavigate?: () => void;
};

/**
 * A section's title. With `onNavigate` the title and its chevron are one tap
 * target, sized for a thumb, and the chevron sits right after the words so it
 * reads as part of them.
 */
export function SectionHeader({
  title,
  accent,
  count,
  trailing,
  onNavigate,
}: SectionHeaderProps) {
  const colors = useColors();

  const titleContent = (
    <Text
      variant="subtitle"
      numberOfLines={1}
      style={[styles.title, { color: colors.text }]}
    >
      {title}
      {accent ? <> {accent}</> : null}
      {typeof count === "number" ? (
        <Text variant="caption" style={{ color: colors.subtle }}>
          {"  "}
          {count}
        </Text>
      ) : null}
    </Text>
  );

  return (
    <View style={styles.row}>
      {onNavigate ? (
        <Pressable
          accessibilityRole="button"
          onPress={onNavigate}
          hitSlop={{ top: 4, bottom: 4 }}
          style={({ pressed }) => [
            styles.titleGroup,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          {titleContent}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.subtle}
            style={styles.chevron}
          />
        </Pressable>
      ) : (
        <View accessibilityRole="header" style={styles.titleGroup}>
          {titleContent}
        </View>
      )}
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 2,
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    minHeight: 40,
  },
  title: {
    ...Fonts.bold,
    fontSize: 21,
    flexShrink: 1,
  },
  chevron: {
    marginLeft: 2,
    marginTop: 1,
  },
});
