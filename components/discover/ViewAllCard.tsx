import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

type ViewAllCardProps = {
  size: number;
  onPress: () => void;
};

export function ViewAllCard({ size, onPress }: ViewAllCardProps) {
  const colors = useColors();

  return (
    <Card
      onPress={onPress}
      radius={10}
      pressedOpacity={0.7}
      style={[styles.card, { width: size, height: size }]}
    >
      <Ionicons name="grid-outline" size={24} color={colors.brand} />
      <Text variant="caption" style={[styles.label, { color: colors.brand }]}>
        View All
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    ...Fonts.semiBold,
  },
});
