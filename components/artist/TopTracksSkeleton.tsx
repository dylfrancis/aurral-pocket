import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";

const TITLE_WIDTHS = [180, 140, 200, 160, 120];

type TopTracksSkeletonProps = {
  count?: number;
};

export function TopTracksSkeleton({ count = 5 }: TopTracksSkeletonProps) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <View style={styles.meta}>
            <Skeleton
              width={TITLE_WIDTHS[i % TITLE_WIDTHS.length]}
              height={14}
              borderRadius={4}
            />
            <Skeleton width={110} height={11} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
});
