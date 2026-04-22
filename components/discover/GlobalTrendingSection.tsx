import { StyleSheet, View, ScrollView } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { useDiscovery } from "@/hooks/discover";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import type { DiscoveryArtist } from "@/lib/types/search";
import { HorizontalArtistCard } from "./HorizontalArtistCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ViewAllCard } from "./ViewAllCard";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";

const MAX_VISIBLE = 12;
const CARD_SIZE = 130;

type Props = {
  onArtistPress: (artist: DiscoveryArtist) => void;
  onViewAll?: () => void;
};

export function GlobalTrendingSection({ onArtistPress, onViewAll }: Props) {
  const colors = Colors[useColorScheme()];
  const { data, isLoading } = useDiscovery();
  const { isInLibrary } = useLibraryLookup();

  const all = data?.globalTop ?? [];
  const artists = all.slice(0, MAX_VISIBLE);
  const hasMore = all.length > MAX_VISIBLE;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text
          variant="caption"
          style={[styles.label, { color: colors.subtle }]}
        >
          Global Trending
        </Text>
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (artists.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionHeader title="Global Trending" onNavigate={onViewAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {artists.map((artist) => (
          <HorizontalArtistCard
            key={artist.id}
            mbid={artist.id}
            name={artist.name}
            isInLibrary={isInLibrary(artist.id)}
            onPress={() => onArtistPress(artist)}
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
