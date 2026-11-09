import { ScrollView, StyleSheet, View } from "react-native";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { formatCompactCount } from "@/lib/discover/trending-format";
import type { TrendingArtist } from "@/lib/types/search";
import { HorizontalArtistCard } from "./HorizontalArtistCard";

type Props = {
  artists: TrendingArtist[];
  onOpenArtist: (artist: TrendingArtist & { mbid: string }) => void;
};

export function TrendingArtistRail({ artists, onOpenArtist }: Props) {
  const { isInLibrary } = useLibraryLookup(
    artists.map((artist) => artist.mbid),
  );

  return (
    <View style={styles.container}>
      <SectionHeader title="Top Artists" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {artists.map((artist) => {
          const { mbid } = artist;
          return (
            <HorizontalArtistCard
              key={artist.key}
              mbid={mbid ?? ""}
              imageUrl={artist.imageUrl}
              name={artist.name}
              subtitle={
                artist.fans
                  ? `No. ${artist.position} · ${formatCompactCount(artist.fans)} fans`
                  : `No. ${artist.position}`
              }
              isInLibrary={!!mbid && isInLibrary(mbid)}
              // Artists Aurral couldn't match to MusicBrainz have no page.
              onPress={
                mbid ? () => onOpenArtist({ ...artist, mbid }) : undefined
              }
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
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
});
