import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { RecentReleaseAlbum } from "@/lib/types/search";

export type DiscoverReleaseCardProps = {
  album: RecentReleaseAlbum;
  onPress: () => void;
};

const CARD_WIDTH = 140;

function parseCalendarDate(value?: string | null) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function formatReleaseStatus(releaseDate?: string | null) {
  const date = parseCalendarDate(releaseDate);
  if (!date) return null;
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const formatted = date.toLocaleDateString();
  if (date.getTime() === start.getTime()) return "Released today";
  if (date < start) return `Released ${formatted}`;
  return `Releasing ${formatted}`;
}

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
