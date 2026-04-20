import { StyleSheet, View, ScrollView } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { useRecentReleases } from "@/hooks/discover";
import type { RecentReleaseAlbum } from "@/lib/types/search";
import { DiscoverReleaseCard } from "./DiscoverReleaseCard";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";

type Props = {
  onAlbumPress: (album: RecentReleaseAlbum) => void;
};

export function RecentReleasesSection({ onAlbumPress }: Props) {
  const colors = Colors[useColorScheme()];
  const { data, isLoading } = useRecentReleases();

  const albums = (data ?? []).slice(0, 12);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text
          variant="caption"
          style={[styles.label, { color: colors.subtle }]}
        >
          Recent & Upcoming Releases
        </Text>
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (albums.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text variant="caption" style={[styles.label, { color: colors.subtle }]}>
        Recent & Upcoming Releases
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {albums.map((album) => (
          <DiscoverReleaseCard
            key={album.id || album.mbid || album.foreignAlbumId}
            album={album}
            onPress={() => onAlbumPress(album)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  label: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
});
