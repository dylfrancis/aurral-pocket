import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type ViewAllCardProps = {
  size: number;
  onPress: () => void;
};

export function ViewAllCard({ size, onPress }: ViewAllCardProps) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          width: size,
          height: size,
          backgroundColor: colors.card,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name="grid-outline" size={24} color={colors.brand} />
      <Text variant="caption" style={[styles.label, { color: colors.brand }]}>
        View All
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    fontFamily: Fonts.semiBold,
  },
});
