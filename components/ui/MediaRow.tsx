import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { CoverArtType } from "@/lib/types/library";

type MediaRowProps = {
  imageType: CoverArtType;
  mbid?: string | null;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress: () => void;
};

const ARTIST_THUMB_SIZE = 48;
const ALBUM_THUMB_SIZE = 56;

// Generic list row for the list mode of screens whose grid cells are
// artwork cards. Mirrors the search result row styling.
export const MediaRow = React.memo(function MediaRow({
  imageType,
  mbid,
  title,
  subtitle,
  trailing,
  onPress,
}: MediaRowProps) {
  const colors = Colors[useColorScheme()];
  const thumbSize =
    imageType === "artist" ? ARTIST_THUMB_SIZE : ALBUM_THUMB_SIZE;
  const borderRadius = imageType === "artist" ? thumbSize / 2 : 6;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {mbid ? (
        <CoverArtImage
          type={imageType}
          mbid={mbid}
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
      )}

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
      </View>

      {trailing}

      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
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
