import { StyleSheet, View, ScrollView } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { useRecentlyAdded } from "@/hooks/discover";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import type { RecentlyAddedArtist } from "@/lib/types/search";
import { HorizontalArtistCard } from "./HorizontalArtistCard";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";

type Props = {
  onArtistPress: (artist: RecentlyAddedArtist) => void;
};

function formatAdded(date?: string | null) {
  if (!date) return undefined;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  return `Added ${d.toLocaleDateString()}`;
}

export function RecentlyAddedSection({ onArtistPress }: Props) {
  const colors = Colors[useColorScheme()];
  const { data, isLoading } = useRecentlyAdded();
  const { isInLibrary } = useLibraryLookup();

  const artists = (data ?? []).slice(0, 10);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text
          variant="caption"
          style={[styles.label, { color: colors.subtle }]}
        >
          Recently Added
        </Text>
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (artists.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text variant="caption" style={[styles.label, { color: colors.subtle }]}>
        Recently Added
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {artists.map((artist) => {
          const mbid = artist.mbid || artist.foreignArtistId || artist.id;
          return (
            <HorizontalArtistCard
              key={artist.id}
              mbid={mbid}
              name={artist.artistName}
              subtitle={formatAdded(artist.addedAt || artist.added)}
              isInLibrary={isInLibrary(mbid)}
              onPress={() => onArtistPress(artist)}
            />
          );
        })}
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
