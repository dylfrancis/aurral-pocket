import { StyleSheet } from "react-native";
import { useDiscovery } from "@/hooks/discover";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import type { DiscoveryArtist } from "@/lib/types/search";
import { ArtistRail } from "./ArtistRail";

type Props = {
  onArtistPress: (artist: DiscoveryArtist) => void;
  onViewAll?: () => void;
};

export function GlobalTrendingSection({ onArtistPress, onViewAll }: Props) {
  const { data, isLoading } = useDiscovery();
  const artists = data?.globalTop ?? [];
  const { isInLibrary } = useLibraryLookup(artists.map((artist) => artist.id));

  return (
    <ArtistRail
      title="Global Trending"
      artists={artists}
      isInLibrary={isInLibrary}
      onArtistPress={onArtistPress}
      onViewAll={onViewAll}
      isLoading={isLoading}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
});
