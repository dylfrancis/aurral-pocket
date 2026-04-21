import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { SimilarArtist } from "@/lib/types/search";

type SimilarArtistCardProps = {
  artist: SimilarArtist;
  isInLibrary: boolean;
  onPress: () => void;
};

const CARD_WIDTH = 130;
const IMAGE_SIZE = 100;

export const SimilarArtistCard = React.memo(function SimilarArtistCard({
  artist,
  isInLibrary,
  onPress,
}: SimilarArtistCardProps) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <CoverArtImage
        type="artist"
        mbid={artist.id}
        size={IMAGE_SIZE}
        borderRadius={IMAGE_SIZE / 2}
      />
      <Text
        variant="body"
        numberOfLines={1}
        style={[styles.name, { color: colors.text }]}
      >
        {artist.name}
      </Text>
      {artist.match > 0 && (
        <Text variant="caption" style={{ color: colors.subtle }}>
          {artist.match}% match
        </Text>
      )}
      {isInLibrary && <Chip label="In Library" variant="brand" />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    alignItems: "center",
    gap: 6,
    marginRight: 12,
  },
  name: {
    fontFamily: Fonts.medium,
    textAlign: "center",
    fontSize: 13,
  },
});
