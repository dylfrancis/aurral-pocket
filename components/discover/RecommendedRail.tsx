import { ScrollView, StyleSheet, View } from "react-native";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { DiscoveryArtist } from "@/lib/types/search";
import { HorizontalArtistCard } from "./HorizontalArtistCard";
import { ViewAllCard } from "./ViewAllCard";

const MAX_VISIBLE = 12;
const CARD_SIZE = 130;

type Props = {
  title: string;
  artists: DiscoveryArtist[];
  subtitle: (artist: DiscoveryArtist) => string;
  isInLibrary: (mbid: string) => boolean;
  onArtistPress: (artist: DiscoveryArtist) => void;
  onViewAll: () => void;
};

export function RecommendedRail({
  title,
  artists,
  subtitle,
  isInLibrary,
  onArtistPress,
  onViewAll,
}: Props) {
  return (
    <View>
      <SectionHeader title={title} onNavigate={onViewAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {artists.slice(0, MAX_VISIBLE).map((artist) => (
          <HorizontalArtistCard
            key={artist.id || artist.name}
            mbid={artist.id}
            name={artist.name}
            subtitle={subtitle(artist)}
            isInLibrary={isInLibrary(artist.id)}
            onPress={() => onArtistPress(artist)}
          />
        ))}
        {artists.length > MAX_VISIBLE ? (
          <ViewAllCard size={CARD_SIZE} onPress={onViewAll} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
});
