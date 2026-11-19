import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { PLAY_ROW_HEIGHT } from "@/components/ui/PlayRow";

/**
 * PlayRow's shape while what it plays is still unknown. Its own file, so a
 * screen that draws a PlayRow doesn't load the skeleton's animation.
 */
export function PlayRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton
        width={PLAY_ROW_HEIGHT}
        height={PLAY_ROW_HEIGHT}
        borderRadius={PLAY_ROW_HEIGHT / 2}
      />
      <Skeleton
        width={PLAY_ROW_HEIGHT * 3}
        height={PLAY_ROW_HEIGHT}
        borderRadius={PLAY_ROW_HEIGHT / 2}
      />
      <Skeleton
        width={PLAY_ROW_HEIGHT}
        height={PLAY_ROW_HEIGHT}
        borderRadius={PLAY_ROW_HEIGHT / 2}
      />
    </View>
  );
}

// PlayRow's own row.
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
});
