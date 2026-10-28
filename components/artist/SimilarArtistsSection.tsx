import { FlatList, StyleSheet, View } from "react-native";
import { SimilarArtistCard } from "@/components/search/SimilarArtistCard";
import { Text } from "@/components/ui/Text";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { SimilarArtist } from "@/lib/types/search";

type SimilarArtistsSectionProps = {
  artists: SimilarArtist[];
  onPress: (artist: SimilarArtist) => void;
};

export function SimilarArtistsSection({
  artists,
  onPress,
}: SimilarArtistsSectionProps) {
  const colors = Colors[useColorScheme()];
  const { isInLibrary } = useLibraryLookup(artists.map((artist) => artist.id));

  if (artists.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text variant="caption" style={[styles.label, { color: colors.subtle }]}>
        Similar Artists
      </Text>
      <FlatList
        horizontal
        data={artists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SimilarArtistCard
            artist={item}
            isInLibrary={isInLibrary(item.id)}
            onPress={() => onPress(item)}
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
    ...Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});
