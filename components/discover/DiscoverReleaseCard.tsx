import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { formatReleaseStatus } from "@/lib/discover/format";
import type { RecentReleaseAlbum } from "@/lib/types/search";

export type DiscoverReleaseCardProps = {
  album: RecentReleaseAlbum;
  onPress: () => void;
};

const CARD_WIDTH = 140;

function DiscoverReleaseCardComponent({
  album,
  onPress,
}: DiscoverReleaseCardProps) {
  const colors = Colors[useColorScheme()];
  const title = album.albumName || album.title || "Untitled";
  const coverMbid = album.mbid || album.foreignAlbumId;
  const status = formatReleaseStatus(album.releaseDate);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}
    >
      {coverMbid ? (
        <CoverArtImage
          type="album"
          mbid={coverMbid}
          size={CARD_WIDTH}
          borderRadius={10}
        />
      ) : (
        <View
          style={{
            width: CARD_WIDTH,
            height: CARD_WIDTH,
            borderRadius: 10,
            backgroundColor: colors.card,
          }}
        />
      )}
      <View style={styles.info}>
        <Text
          variant="body"
          style={[
            styles.title,
            { color: colors.text, fontFamily: Fonts.semiBold },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          variant="caption"
          style={[styles.meta, { color: colors.subtle }]}
          numberOfLines={1}
        >
          {album.artistName || "Unknown Artist"}
        </Text>
        {!!status && (
          <Text
            variant="caption"
            style={[styles.status, { color: colors.subtle }]}
            numberOfLines={1}
          >
            {status}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export const DiscoverReleaseCard = React.memo(DiscoverReleaseCardComponent);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
  },
  info: {
    paddingTop: 8,
    gap: 2,
    height: 76,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    fontSize: 11,
    lineHeight: 14,
  },
  status: {
    fontSize: 11,
    lineHeight: 14,
  },
});
