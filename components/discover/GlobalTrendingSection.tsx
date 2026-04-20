import { StyleSheet, View, ScrollView } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { useDiscovery } from "@/hooks/discover";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import type { DiscoveryArtist } from "@/lib/types/search";
import { HorizontalArtistCard } from "./HorizontalArtistCard";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";

type Props = {
  onArtistPress: (artist: DiscoveryArtist) => void;
};

export function GlobalTrendingSection({ onArtistPress }: Props) {
  const colors = Colors[useColorScheme()];
  const { data, isLoading } = useDiscovery();
  const { isInLibrary } = useLibraryLookup();

  const artists = (data?.globalTop ?? []).slice(0, 12);

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
      <Text variant="caption" style={[styles.label, { color: colors.subtle }]}>
        Global Trending
      </Text>
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
