import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { Text } from "@/components/ui/Text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { EditorialTrack } from "@/lib/types/search";

const COVER_SIZE = 44;
const PLAY_BUTTON_SIZE = 32;

export type EditorialTrackItem = { id: string; track: EditorialTrack };

type Props = {
  item: EditorialTrackItem;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  isLookingUpLink: boolean;
  onTogglePreview: (item: EditorialTrackItem) => void;
  onOpenArtist: (item: EditorialTrackItem) => void;
  onOpenAlbum: (item: EditorialTrackItem) => void;
};

/** A plain View, so a screen reader can reach each of the row's actions. */
export const EditorialTrackRow = React.memo(function EditorialTrackRow({
  item,
  isPlaying,
  isLoading,
  progress,
  isLookingUpLink,
  onTogglePreview,
  onOpenArtist,
  onOpenAlbum,
}: Props) {
  const colors = Colors[useColorScheme()];
  const { track } = item;

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      <View style={styles.playSlot}>
        {track.preview_url ? (
          <Pressable
            onPress={() => onTogglePreview(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${isPlaying ? "Pause" : "Preview"} ${track.trackName}`}
            style={({ pressed }) => [
              styles.playButton,
              {
                backgroundColor: isPlaying ? colors.brand : colors.separator,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={14}
                color={isPlaying ? colors.buttonPrimaryText : colors.text}
                style={isPlaying ? undefined : styles.playIcon}
              />
            )}
          </Pressable>
        ) : null}
      </View>
      <CoverArtImage
        type="album"
        mbid=""
        coverUrl={track.artworkUrl}
        size={COVER_SIZE}
        borderRadius={6}
      />
      <View style={styles.body}>
        <Text
          variant="body"
          numberOfLines={1}
          style={isPlaying ? { color: colors.brand } : undefined}
        >
          {track.trackName}
        </Text>
        <View style={styles.links}>
          <TrackLink
            label={track.artistName}
            accessibilityLabel={`Open artist ${track.artistName}`}
            onPress={() => onOpenArtist(item)}
          />
          {track.albumName ? (
            <>
              <Text variant="caption"> · </Text>
              <TrackLink
                label={track.albumName}
                accessibilityLabel={`Open album ${track.albumName}`}
                onPress={() => onOpenAlbum(item)}
              />
            </>
          ) : null}
        </View>
        {isPlaying ? (
          <View
            style={[styles.progressBar, { backgroundColor: colors.separator }]}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%`, backgroundColor: colors.brand },
              ]}
            />
          </View>
        ) : null}
      </View>
      {isLookingUpLink ? (
        <ActivityIndicator size="small" color={colors.subtle} />
      ) : null}
    </View>
  );
});

function TrackLink({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Text variant="caption" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  playSlot: {
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
  },
  playButton: {
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
    borderRadius: PLAY_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    marginLeft: 2,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  links: {
    flexDirection: "row",
    alignItems: "center",
  },
  link: {
    flexShrink: 1,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    marginTop: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1,
  },
});
