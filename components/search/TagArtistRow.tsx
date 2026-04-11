import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { TagArtist } from "@/lib/types/search";

type TagArtistRowProps = {
  artist: TagArtist;
  isInLibrary: boolean;
  onPress: () => void;
};

const THUMB_SIZE = 48;

export const TagArtistRow = React.memo(function TagArtistRow({
  artist,
  isInLibrary,
  onPress,
}: TagArtistRowProps) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <CoverArtImage
        type="artist"
        mbid={artist.id}
        size={THUMB_SIZE}
        borderRadius={THUMB_SIZE / 2}
      />

      <View style={styles.meta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.name, { color: colors.text }]}
        >
          {artist.name}
        </Text>
        {artist.tags.length > 0 && (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: colors.subtle }}
          >
            {artist.tags.slice(0, 3).join(" · ")}
          </Text>
        )}
      </View>

      {isInLibrary && <Chip label="In Library" variant="brand" />}

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
  name: {
    fontFamily: Fonts.medium,
  },
});
