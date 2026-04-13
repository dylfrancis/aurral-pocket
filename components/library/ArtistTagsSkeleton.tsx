import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";

const CHIP_WIDTHS = [70, 90, 60, 110, 75, 85];

export function ArtistTagsSkeleton() {
  return (
    <View style={styles.container}>
      {CHIP_WIDTHS.map((width, i) => (
        <Skeleton key={i} width={width} height={22} borderRadius={12} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
