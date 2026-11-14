import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { TrackIndexSlot } from "@/components/library/TrackIndexSlot";
import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { SavedTrackMark } from "@/components/offline/SavedMark";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTrackPlayback } from "@/hooks/player/use-track-playback";
import { Colors } from "@/constants/theme";
import type { Track } from "@/lib/types/library";

type TrackRowProps = {
  track: Track;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Opens the track's action sheet. Omitted, the row shows no menu button. */
  onMenuPress?: () => void;
  /** Can't play right now: offline, and not saved on the phone. */
  unavailable?: boolean;
  /** Shows ↓ once the track is on the phone. */
  markSaved?: boolean;
};

export const TrackRow = React.memo(function TrackRow({
  track,
  onPress,
  onLongPress,
  onMenuPress,
  unavailable = false,
  markSaved = false,
}: TrackRowProps) {
  const colors = Colors[useColorScheme()];
  const { isCurrent, isPlaying } = useTrackPlayback(String(track.id));

  // Every tap reaches the screen, unplayable tracks included — the screen
  // explains why one cannot play. Swallowing it here would make an
  // unplayable track look like a broken player.
  const interactive = !!onPress || !!onLongPress;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!interactive}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.separator },
        unavailable ? styles.unavailable : null,
        pressed && interactive ? { opacity: 0.6 } : null,
      ]}
    >
      <TrackIndexSlot
        number={track.trackNumber}
        isCurrent={isCurrent}
        isPlaying={isPlaying}
      />
      <Text
        variant="body"
        numberOfLines={1}
        style={[styles.title, isCurrent && { color: colors.brand }]}
      >
        {track.trackName}
      </Text>
      {markSaved ? <SavedTrackMark trackId={String(track.id)} /> : null}
      <Ionicons
        name={track.hasFile ? "checkmark-circle" : "remove-circle-outline"}
        size={16}
        color={track.hasFile ? colors.brand : colors.subtle}
      />
      {onMenuPress && (
        <TrackMenuButton trackName={track.trackName} onPress={onMenuPress} />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  unavailable: {
    opacity: 0.4,
  },
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
});
