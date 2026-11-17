import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { TrackIndexSlot } from "@/components/library/TrackIndexSlot";
import { useAudioPreview } from "@/hooks/library/use-audio-preview";
import type { EditionTrack } from "@/hooks/library/use-edition-tracks";
import { useColors } from "@/hooks/use-colors";

/**
 * A track the edition lists that the Library has no file for; a tap plays its
 * clip. It follows the player itself, since clip state changes every tick.
 */
export const EditionClipRow = React.memo(function EditionClipRow({
  track,
  artistName,
  albumTitle,
  artwork,
}: {
  track: EditionTrack;
  artistName: string;
  albumTitle: string;
  artwork: string | null;
}) {
  const colors = useColors();
  const { playingId, loadingId, toggle } = useAudioPreview();
  const isPlaying = playingId === track.id;
  const isLoading = loadingId === track.id;
  const hasClip = !!track.preview_url;
  const onPress = () => {
    if (!track.preview_url) return;
    void toggle(track.id, track.preview_url, {
      title: track.title,
      artist: artistName,
      album: albumTitle,
      artwork,
    });
  };
  const tint = isPlaying ? colors.brand : colors.subtle;

  return (
    <Pressable
      onPress={onPress}
      disabled={!hasClip}
      accessibilityRole={hasClip ? "button" : undefined}
      accessibilityLabel={
        hasClip
          ? `${isPlaying ? "Pause" : "Preview"} ${track.title}`
          : `${track.title}, not in your Library`
      }
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.separator },
        pressed && hasClip ? { opacity: 0.6 } : null,
      ]}
    >
      <TrackIndexSlot
        number={track.trackNumber}
        isCurrent={isPlaying || isLoading}
        isPlaying={isPlaying}
      />
      <Text
        variant="body"
        numberOfLines={1}
        style={[styles.title, isPlaying && { color: colors.brand }]}
      >
        {track.title}
      </Text>
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.subtle} />
      ) : (
        <Ionicons
          name={
            !hasClip
              ? "remove-circle-outline"
              : isPlaying
                ? "pause-circle"
                : "play-circle-outline"
          }
          size={16}
          color={tint}
        />
      )}
      <View style={styles.menuSpace} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // TrackRow's, so the two kinds of row line up.
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  title: {
    flex: 1,
  },
  // Where TrackRow has its ⋯ button, so the icons stay in one column.
  menuSpace: {
    width: 22,
  },
});
