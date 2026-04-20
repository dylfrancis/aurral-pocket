import { useMemo } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { useDiscovery } from "@/hooks/discover";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { buildGenreSections } from "@/lib/discover/format";
import type { DiscoveryArtist } from "@/lib/types/search";
import { HorizontalArtistCard } from "./HorizontalArtistCard";

type Props = {
  onArtistPress: (artist: DiscoveryArtist, genre: string) => void;
};

export function GenreSectionsPanel({ onArtistPress }: Props) {
  const colors = Colors[useColorScheme()];
  const { data } = useDiscovery();
  const { isInLibrary } = useLibraryLookup();

  const sections = useMemo(
    () =>
      buildGenreSections(data?.topGenres ?? [], data?.recommendations ?? []),
    [data?.topGenres, data?.recommendations],
  );

  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <View key={section.genre} style={styles.section}>
          <Text
            variant="caption"
            style={[styles.label, { color: colors.subtle }]}
          >
            Because you like {section.genre}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {section.artists.map((artist) => (
              <HorizontalArtistCard
                key={`${section.genre}-${artist.id}`}
                mbid={artist.id}
                name={artist.name}
                isInLibrary={isInLibrary(artist.id)}
                onPress={() => onArtistPress(artist, section.genre)}
              />
            ))}
          </ScrollView>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  section: {
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
