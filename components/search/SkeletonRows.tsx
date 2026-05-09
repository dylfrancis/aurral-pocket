import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";

type Variant = "default" | "artist" | "album";

type SkeletonRowsProps = {
  count?: number;
  variant?: Variant;
};

export function SkeletonRows({
  count = 6,
  variant = "default",
}: SkeletonRowsProps) {
  if (variant === "artist") {
    return (
      <View style={styles.container}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.contentRow}>
            <Skeleton width={48} height={48} borderRadius={24} />
            <Skeleton width={140 + (i % 3) * 30} height={14} borderRadius={4} />
          </View>
        ))}
      </View>
    );
  }

  if (variant === "album") {
    return (
      <View style={styles.container}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.contentRow}>
            <Skeleton width={56} height={56} borderRadius={6} />
            <View style={styles.lines}>
              <Skeleton
                width={160 + (i % 3) * 30}
                height={14}
                borderRadius={4}
              />
              <Skeleton
                width={100 + (i % 4) * 20}
                height={11}
                borderRadius={4}
              />
              <Skeleton
                width={60 + (i % 3) * 30}
                height={11}
                borderRadius={4}
              />
            </View>
          </View>
        ))}
      </View>
    );
  }

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
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  lines: {
    flex: 1,
    gap: 6,
  },
});
