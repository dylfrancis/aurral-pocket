import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type LibraryBadgeProps = {
  onPress: () => void;
};

export function LibraryBadge({ onPress }: LibraryBadgeProps) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.badge,
        { backgroundColor: colors.brandMuted, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name="checkmark-circle" size={20} color={colors.brandStrong} />
      <Text
        variant="body"
        style={[styles.label, { color: colors.brandStrong }]}
      >
        In Your Library
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 5,
  },
  label: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
});
