import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "./CoverArtImage";
import { Fonts } from "@/constants/theme";
import type { Artist } from "@/lib/types/library";
import { useColors } from "@/hooks/use-colors";

type ArtistCardProps = {
  artist: Artist;
  onPress: () => void;
  /** Opens the artist's actions. */
  onLongPress?: () => void;
};

export const ArtistCard = React.memo(function ArtistCard({
  artist,
  onPress,
  onLongPress,
}: ArtistCardProps) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <CoverArtImage
        type="artist"
        mbid={artist.mbid}
        coverUrl={artist.coverUrl}
        size="fill"
      />
      <View style={styles.info}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.name, { color: colors.text }]}
        >
          {artist.artistName}
        </Text>
        <Text variant="caption" style={styles.count}>
          {artist.statistics.albumCount}{" "}
          {artist.statistics.albumCount === 1 ? "album" : "albums"}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  info: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 2,
    alignItems: "center",
  },
  name: {
    ...Fonts.semiBold,
    textAlign: "center",
  },
  count: {
    textAlign: "center",
  },
});
