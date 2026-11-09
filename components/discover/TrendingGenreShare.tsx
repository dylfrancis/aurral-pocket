import { StyleSheet, View } from "react-native";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { TrendingGenreShare as GenreShare } from "@/lib/types/search";

export function TrendingGenreShare({ share }: { share: GenreShare }) {
  const colors = Colors[useColorScheme()];
  const largestCount = share.genres[0]?.count || 1;

  return (
    <View style={styles.container}>
      <SectionHeader title={`Genres in the Top ${share.total} Albums`} />
      <View style={styles.list}>
        {share.genres.map((genre) => (
          <View
            key={genre.name}
            accessible
            accessibilityLabel={`${genre.name}, ${genre.count} of ${share.total} albums`}
            style={styles.row}
          >
            <Text variant="caption" numberOfLines={1} style={styles.name}>
              {genre.name}
            </Text>
            <View style={[styles.track, { backgroundColor: colors.separator }]}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${Math.max(2, (100 * genre.count) / largestCount)}%`,
                    backgroundColor: colors.brand,
                  },
                ]}
              />
            </View>
            <Text variant="caption" style={styles.count}>
              {genre.count}
            </Text>
          </View>
        ))}
        {share.other > 0 ? (
          <Text variant="caption" style={{ color: colors.subtle }}>
            Other genres: {share.other}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  list: {
    paddingHorizontal: 16,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: {
    width: 110,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 4,
  },
  count: {
    ...Fonts.semiBold,
    width: 28,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
});
