import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { SearchAlbum } from "@/lib/types/search";

export type SearchAlbumCardProps = {
  album: SearchAlbum;
  onPress: () => void;
};

function SearchAlbumCardComponent({ album, onPress }: SearchAlbumCardProps) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}
    >
      <CoverArtImage
        type="album"
        mbid={album.id}
        size="fill"
        borderRadius={10}
      />
      <View style={styles.info}>
        <Text
          variant="body"
          style={[styles.title, { color: colors.text, ...Fonts.semiBold }]}
          numberOfLines={2}
        >
          {album.title}
        </Text>
        <Text
          variant="caption"
          style={[styles.meta, { color: colors.subtle }]}
          numberOfLines={1}
        >
          {album.artistName}
        </Text>
      </View>
    </Pressable>
  );
}

export const SearchAlbumCard = React.memo(SearchAlbumCardComponent);

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  info: {
    paddingTop: 8,
    gap: 2,
    height: 60,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    fontSize: 11,
    lineHeight: 14,
  },
});
