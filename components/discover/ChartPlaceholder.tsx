import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { useColors } from "@/hooks/use-colors";

export function ChartPlaceholder({ title }: { title: string }) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <SectionHeader title={title} />
      <Card bordered style={styles.card}>
        <Ionicons name="time-outline" size={20} color={colors.subtle} />
        <Text variant="caption" style={[styles.text, { color: colors.subtle }]}>
          This chart is still loading. Check back soon.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  card: {
    marginHorizontal: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  text: {
    flex: 1,
  },
});
