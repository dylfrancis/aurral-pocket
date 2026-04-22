import { StyleSheet, View, ScrollView } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { useRecentReleases } from "@/hooks/discover";
import type { RecentReleaseAlbum } from "@/lib/types/search";
import { DiscoverReleaseCard } from "./DiscoverReleaseCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ViewAllCard } from "./ViewAllCard";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";

const MAX_VISIBLE = 12;
const CARD_SIZE = 140;

type Props = {
  onAlbumPress: (album: RecentReleaseAlbum) => void;
  onViewAll?: () => void;
};

export function RecentReleasesSection({ onAlbumPress, onViewAll }: Props) {
  const colors = Colors[useColorScheme()];
  const { data, isLoading } = useRecentReleases();

  const all = data ?? [];
  const albums = all.slice(0, MAX_VISIBLE);
  const hasMore = all.length > MAX_VISIBLE;

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
      <SectionHeader
        title="Recent & Upcoming Releases"
        onNavigate={onViewAll}
      />
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
        {hasMore && onViewAll ? (
          <ViewAllCard size={CARD_SIZE} onPress={onViewAll} />
        ) : null}
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
