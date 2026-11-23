import { StyleSheet } from "react-native";
import { useTrendingCharts } from "@/hooks/discover/use-trending";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import type { TrendingArtist } from "@/lib/types/search";
import { DiscoverRail } from "./DiscoverRail";
import { ARTIST_CARD_WIDTH } from "./HorizontalArtistCard";
import { TrendingArtistCard } from "./TrendingArtistCard";

type Props = {
  onOpenArtist: (artist: TrendingArtist & { mbid: string }) => void;
  onViewAll?: () => void;
};

/** The artist chart from the Trending tab, as the web's Discover shows it. */
export function TrendingArtistsSection({ onOpenArtist, onViewAll }: Props) {
  const { data, isLoading } = useTrendingCharts();
  const artists = data?.artists ?? [];
  // The whole chart, as the Trending tab passes it, so they share a lookup.
  const { isInLibrary } = useLibraryLookup(
    artists.map((artist) => artist.mbid),
  );

  return (
    <DiscoverRail
      title="Trending Artists"
      items={artists}
      keyOf={(artist) => artist.key}
      renderItem={(artist) => (
        <TrendingArtistCard
          artist={artist}
          isInLibrary={!!artist.mbid && isInLibrary(artist.mbid)}
          onOpenArtist={onOpenArtist}
        />
      )}
      cardSize={ARTIST_CARD_WIDTH}
      cardShape="circle"
      isLoading={isLoading}
      onViewAll={onViewAll}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
});
