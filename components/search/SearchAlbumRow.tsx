import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { AlbumSearchStatusBadge } from "./AlbumSearchStatusBadge";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { SearchAlbum } from "@/lib/types/search";

type SearchAlbumRowProps = {
  album: SearchAlbum;
  onPress: () => void;
};

const THUMB_SIZE = 56;

function formatMeta(album: SearchAlbum) {
  const parts: string[] = [];
  if (album.releaseDate) {
    const year = new Date(album.releaseDate).getFullYear();
    if (Number.isFinite(year)) parts.push(String(year));
  }
  if (album.primaryType) parts.push(album.primaryType);
  parts.push(...album.secondaryTypes);
  return parts.join(" · ");
}

export const SearchAlbumRow = React.memo(function SearchAlbumRow({
  album,
  onPress,
}: SearchAlbumRowProps) {
  const colors = Colors[useColorScheme()];
  const meta = formatMeta(album);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <CoverArtImage
        type="album"
        mbid={album.id}
        size={THUMB_SIZE}
        borderRadius={6}
      />

      <View style={styles.meta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.title, { color: colors.text }]}
        >
          {album.title}
        </Text>
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: colors.subtle }}
        >
          {album.artistName}
        </Text>
        {!!meta && (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: colors.subtle }}
          >
            {meta}
          </Text>
        )}
      </View>

      <View style={styles.trailing}>
        <AlbumSearchStatusBadge status={album.status} />
        <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: Fonts.medium,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
