import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";

const CARD_WIDTH = 150;
const CARD_COUNT = 4;

export function AlbumCategorySkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Skeleton width={100} height={20} borderRadius={6} />
      </View>
      <View style={styles.row}>
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <View key={i} style={styles.card}>
            <Skeleton
              width={CARD_WIDTH}
              height={CARD_WIDTH}
              borderRadius={10}
            />
            <View style={styles.meta}>
              <Skeleton width={120} height={13} borderRadius={4} />
              <Skeleton width={80} height={11} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  card: {
    width: CARD_WIDTH,
    marginRight: 12,
  },
  meta: {
    paddingTop: 6,
    gap: 4,
  },
});
