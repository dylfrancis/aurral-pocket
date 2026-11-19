import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";

const CARD_COUNT = 4;
// The sizes of AlbumCard and HorizontalArtistCard.
const SQUARE_CARD_WIDTH = 150;
const CIRCLE_CARD_WIDTH = 130;

type AlbumCategorySkeletonProps = {
  /** "circle" for a rail of artists, which draw round. */
  shape?: "square" | "circle";
  /** Off under a rail that already draws its real header while it loads. */
  header?: boolean;
};

/** A rail while it loads: its header, then a row of cards. */
export function AlbumCategorySkeleton({
  shape = "square",
  header = true,
}: AlbumCategorySkeletonProps) {
  const circle = shape === "circle";
  const width = circle ? CIRCLE_CARD_WIDTH : SQUARE_CARD_WIDTH;

  return (
    // Standalone, it keeps the gap a loaded rail would leave below it.
    <View style={header ? styles.container : undefined}>
      {header ? (
        <View style={styles.header}>
          <Skeleton width={140} height={22} borderRadius={6} />
        </View>
      ) : null}
      <View style={styles.row}>
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <View key={i} style={{ width }}>
            <Skeleton
              width={width}
              height={width}
              borderRadius={circle ? width / 2 : 10}
            />
            <View style={[styles.meta, circle && styles.metaCentered]}>
              <Skeleton
                width={circle ? 90 : 120}
                height={13}
                borderRadius={4}
              />
              <Skeleton width={circle ? 64 : 80} height={11} borderRadius={4} />
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
  // SectionHeader's row: as tall as its tap target.
  header: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
  },
  meta: {
    paddingTop: 8,
    gap: 4,
  },
  metaCentered: {
    alignItems: "center",
  },
});
