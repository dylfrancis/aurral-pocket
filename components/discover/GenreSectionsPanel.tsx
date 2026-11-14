import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useDiscovery } from "@/hooks/discover";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { buildGenreSections } from "@/lib/discover/format";
import { recommendationReason, seedNameSet } from "@/lib/discover/recommended";
import type { DiscoveryArtist } from "@/lib/types/search";
import { ArtistRail } from "./ArtistRail";
import { useColors } from "@/hooks/use-colors";

type Props = {
  onArtistPress: (artist: DiscoveryArtist, genre: string) => void;
  onViewAllGenre: (genre: string) => void;
};

export function GenreSectionsPanel({ onArtistPress, onViewAllGenre }: Props) {
  const colors = useColors();
  const { data } = useDiscovery();
  const { isInLibrary } = useLibraryLookup(
    (data?.recommendations ?? []).map((artist) => artist.id),
  );

  const seeds = useMemo(
    () => seedNameSet(data?.basedOn ?? []),
    [data?.basedOn],
  );

  const sections = useMemo(
    () =>
      buildGenreSections(data?.topGenres ?? [], data?.recommendations ?? []),
    [data?.topGenres, data?.recommendations],
  );

  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <ArtistRail
          key={section.genre}
          title="Because you like"
          accent={
            <Text style={[styles.tag, { color: colors.text }]}>
              #{section.genre}
            </Text>
          }
          artists={section.artists}
          subtitle={(artist) => recommendationReason(artist, seeds)}
          isInLibrary={isInLibrary}
          onArtistPress={(artist) => onArtistPress(artist, section.genre)}
          onViewAll={() => onViewAllGenre(section.genre)}
          style={styles.section}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: 4,
  },
  tag: {
    ...Fonts.semiBold,
    fontSize: 18,
  },
});
