import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type SectionHeaderProps = {
  title: string;
  accent?: ReactNode;
  count?: number;
  trailing?: ReactNode;
  onNavigate?: () => void;
};

export function SectionHeader({
  title,
  accent,
  count,
  trailing,
  onNavigate,
}: SectionHeaderProps) {
  const colors = Colors[useColorScheme()];

  const titleContent = (
    <Text variant="subtitle" style={[styles.title, { color: colors.text }]}>
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

  const chevron = onNavigate ? (
    <Ionicons
      name="chevron-forward"
      size={18}
      color={colors.subtle}
      style={styles.chevron}
    />
  ) : null;

  if (trailing) {
    return (
      <View style={styles.row}>
        {onNavigate ? (
          <Pressable
            onPress={onNavigate}
            style={({ pressed }) => [
              styles.titleGroup,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            {titleContent}
            {chevron}
          </Pressable>
        ) : (
          <View style={styles.titleGroup}>{titleContent}</View>
        )}
        {trailing}
      </View>
    );
  }

  if (onNavigate) {
    return (
      <Pressable
        onPress={onNavigate}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      >
        {titleContent}
        {chevron}
      </Pressable>
    );
  }

  return <View style={styles.row}>{titleContent}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
  },
  chevron: {
    marginLeft: 4,
  },
});
