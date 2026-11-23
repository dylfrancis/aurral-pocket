import { FlatList, StyleSheet, View } from "react-native";
import { useItemActions } from "@/components/actions/item-actions-context";
import { SimilarArtistCard } from "@/components/search/SimilarArtistCard";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import type { SimilarArtist } from "@/lib/types/search";
import { SectionLabel } from "@/components/ui/SectionLabel";

type SimilarArtistsSectionProps = {
  artists: SimilarArtist[];
  onPress: (artist: SimilarArtist) => void;
};

export function SimilarArtistsSection({
  artists,
  onPress,
}: SimilarArtistsSectionProps) {
  const { isInLibrary } = useLibraryLookup(artists.map((artist) => artist.id));
  const { openArtist } = useItemActions();

  if (artists.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionLabel style={styles.label}>Similar Artists</SectionLabel>
      <FlatList
        horizontal
        data={artists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SimilarArtistCard
            artist={item}
            isInLibrary={isInLibrary(item.id)}
            onPress={() => onPress(item)}
            onLongPress={() => openArtist({ ref: item.id, name: item.name })}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  label: {
    paddingHorizontal: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});
