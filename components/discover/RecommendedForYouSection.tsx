import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useDiscovery } from "@/hooks/discover";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { recommendationReason, seedNameSet } from "@/lib/discover/recommended";
import type { DiscoveryArtist } from "@/lib/types/search";
import { ArtistRail } from "./ArtistRail";

type Props = {
  onArtistPress: (artist: DiscoveryArtist) => void;
  onViewAll?: () => void;
};

export function RecommendedForYouSection({ onArtistPress, onViewAll }: Props) {
  const { data, isLoading } = useDiscovery();
  const artists = data?.recommendations ?? [];
  // Every recommendation, not just the visible ones, so the genre sections
  // and the full list share this lookup.
  const { isInLibrary } = useLibraryLookup(artists.map((artist) => artist.id));

  const seeds = useMemo(
    () => seedNameSet(data?.basedOn ?? []),
    [data?.basedOn],
  );

  return (
    <ArtistRail
      title="Recommended For You"
      artists={artists}
      subtitle={(artist) => recommendationReason(artist, seeds)}
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
