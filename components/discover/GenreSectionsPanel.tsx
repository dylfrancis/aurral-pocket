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
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ViewAllCard } from "./ViewAllCard";

const MAX_VISIBLE = 12;
const CARD_SIZE = 130;

type Props = {
  onArtistPress: (artist: DiscoveryArtist, genre: string) => void;
  onViewAllGenre: (genre: string) => void;
};

export function GenreSectionsPanel({ onArtistPress, onViewAllGenre }: Props) {
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
      {sections.map((section) => {
        const artists = section.artists.slice(0, MAX_VISIBLE);
        const hasMore = section.artists.length > MAX_VISIBLE;
        const viewAll = () => onViewAllGenre(section.genre);
        return (
          <View key={section.genre} style={styles.section}>
            <SectionHeader
              title="Because you like"
              accent={
                <Text style={[styles.tag, { color: colors.text }]}>
                  #{section.genre}
                </Text>
              }
              onNavigate={viewAll}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
            >
              {artists.map((artist) => (
                <HorizontalArtistCard
                  key={`${section.genre}-${artist.id}`}
                  mbid={artist.id}
                  name={artist.name}
                  isInLibrary={isInLibrary(artist.id)}
                  onPress={() => onArtistPress(artist, section.genre)}
                />
              ))}
              {hasMore ? (
                <ViewAllCard size={CARD_SIZE} onPress={viewAll} />
              ) : null}
            </ScrollView>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: 4,
  },
  tag: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
});
