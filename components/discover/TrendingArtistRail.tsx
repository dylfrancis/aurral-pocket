import { ScrollView, StyleSheet, View } from "react-native";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import type { TrendingArtist } from "@/lib/types/search";
import { TrendingArtistCard } from "./TrendingArtistCard";

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
        {artists.map((artist) => (
          <TrendingArtistCard
            key={artist.key}
            artist={artist}
            isInLibrary={!!artist.mbid && isInLibrary(artist.mbid)}
            onOpenArtist={onOpenArtist}
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
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
});
