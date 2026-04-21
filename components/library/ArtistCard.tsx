import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "./CoverArtImage";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { Artist } from "@/lib/types/library";

type ArtistCardProps = {
  artist: Artist;
  onPress: () => void;
};

export const ArtistCard = React.memo(function ArtistCard({
  artist,
  onPress,
}: ArtistCardProps) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <CoverArtImage
        type="artist"
        mbid={artist.mbid}
        size="fill"
        borderRadius={12}
      />
      <View style={styles.info}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.name, { color: colors.text }]}
        >
          {artist.artistName}
        </Text>
        <Text variant="caption">
          {artist.statistics.albumCount}{" "}
          {artist.statistics.albumCount === 1 ? "album" : "albums"}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
  },
  info: {
    padding: 8,
    gap: 2,
  },
  name: {
    fontFamily: Fonts.semiBold,
  },
});
