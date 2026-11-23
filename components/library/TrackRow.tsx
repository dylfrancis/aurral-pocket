import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { AlbumTrackRow } from "@/components/library/AlbumTrackRow";
import { TrackIndexSlot } from "@/components/library/TrackIndexSlot";
import { SavedTrackMark } from "@/components/offline/SavedMark";
import { useTrackPlayback } from "@/hooks/player/use-track-playback";
import type { Track } from "@/lib/types/library";
import { useColors } from "@/hooks/use-colors";

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
  popular?: boolean;
};

export const TrackRow = React.memo(function TrackRow({
  track,
  onPress,
  onLongPress,
  onMenuPress,
  unavailable = false,
  markSaved = false,
  popular = false,
}: TrackRowProps) {
  const colors = useColors();
  const { isCurrent, isPlaying } = useTrackPlayback(String(track.id));

  return (
    <AlbumTrackRow
      leading={
        <TrackIndexSlot
          number={track.trackNumber}
          isCurrent={isCurrent}
          isPlaying={isPlaying}
        />
      }
      title={track.trackName}
      popular={popular}
      active={isCurrent}
      trailing={
        <>
          {markSaved ? <SavedTrackMark trackId={String(track.id)} /> : null}
          <Ionicons
            name={track.hasFile ? "checkmark-circle" : "remove-circle-outline"}
            size={16}
            color={track.hasFile ? colors.brand : colors.subtle}
          />
        </>
      }
      onMenuPress={onMenuPress}
      onPress={onPress}
      onLongPress={onLongPress}
      // Faded, not disabled: every tap reaches the screen, which explains why
      // the track can't play. Swallowing it here would make an unplayable
      // track look like a broken player.
      dimmed={unavailable}
    />
  );
});
