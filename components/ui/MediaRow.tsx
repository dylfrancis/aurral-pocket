import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { Fonts } from "@/constants/theme";
import type { CoverArtType } from "@/lib/types/library";
import { useColors } from "@/hooks/use-colors";

type MediaRowProps = {
  /** Omit for a row with no image. */
  imageType?: CoverArtType;
  mbid?: string | null;
  title: string;
  subtitle?: string;
  /** A second caption line under the subtitle. */
  detail?: string;
  trailing?: React.ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  /** Loads the image from the server's artwork path. See CoverArtImage. */
  coverUrl?: string;
  /** Off for a row that acts in place instead of opening a screen. */
  showChevron?: boolean;
  /** Drawn in place of the cover, for art that comes from elsewhere. */
  image?: React.ReactNode;
};

const ARTIST_THUMB_SIZE = 48;
const ALBUM_THUMB_SIZE = 56;

// List row for search results and for screens whose grid cells are artwork
// cards.
export const MediaRow = React.memo(function MediaRow({
  imageType,
  mbid,
  title,
  subtitle,
  detail,
  trailing,
  onPress,
  onLongPress,
  coverUrl,
  showChevron = true,
  image,
}: MediaRowProps) {
  const colors = useColors();
  const thumbSize =
    imageType === "artist" ? ARTIST_THUMB_SIZE : ALBUM_THUMB_SIZE;
  const borderRadius = imageType === "artist" ? thumbSize / 2 : 6;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.container,
        { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {image ??
        (imageType &&
          (mbid || coverUrl ? (
            <CoverArtImage
              type={imageType}
              mbid={mbid ?? ""}
              coverUrl={coverUrl}
              size={thumbSize}
              borderRadius={borderRadius}
            />
          ) : (
            <View
              style={{
                width: thumbSize,
                height: thumbSize,
                borderRadius,
                backgroundColor: colors.card,
              }}
            />
          )))}

      <View style={styles.meta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.title, { color: colors.text }]}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: colors.subtle }}
          >
            {subtitle}
          </Text>
        )}
        {!!detail && (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: colors.subtle }}
          >
            {detail}
          </Text>
        )}
      </View>

      {trailing}

      {showChevron && (
        <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
      )}
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
    ...Fonts.medium,
  },
});
