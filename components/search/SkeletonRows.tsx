import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";

type SkeletonRowsProps = {
  count?: number;
};

export function SkeletonRows({ count = 6 }: SkeletonRowsProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={16} height={16} borderRadius={8} />
          <Skeleton width={140 + (i % 3) * 40} height={16} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
});
