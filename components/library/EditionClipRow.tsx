import React from "react";
import { ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AlbumTrackRow } from "@/components/library/AlbumTrackRow";
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
    <AlbumTrackRow
      leading={
        <TrackIndexSlot
          number={track.trackNumber}
          isCurrent={isPlaying || isLoading}
          isPlaying={isPlaying}
        />
      }
      title={track.title}
      popular={track.popular}
      active={isPlaying}
      trailing={
        isLoading ? (
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
        )
      }
      // It sits among Library tracks, so its icon lines up with theirs.
      holdMenuSpace
      onPress={hasClip ? onPress : undefined}
      accessibilityRole={hasClip ? "button" : undefined}
      accessibilityLabel={
        hasClip
          ? `${isPlaying ? "Pause" : "Preview"} ${track.title}`
          : `${track.title}, not in your Library`
      }
    />
  );
});
