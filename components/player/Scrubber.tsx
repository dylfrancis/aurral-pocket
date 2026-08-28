import Slider from "@react-native-community/slider";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { seekTo, useCurrentTrack, useProgress } from "@/lib/player/player";

/**
 * How close, in seconds, the engine's reported position must come to a seek
 * target before the ticks take the thumb back over. Ticks land about once a
 * second; without this hold the thumb snaps back to the pre-seek position
 * for a beat after every drag.
 */
const SEEK_SETTLE_SECONDS = 2;

/**
 * The seek bar with its time labels. This is the only part of the player UI
 * that subscribes to progress ticks — a tick re-renders this component and
 * nothing else. While a drag is in flight the drag value wins over the ticks.
 */
export function Scrubber() {
  const colors = Colors[useColorScheme()];
  const trackId = useCurrentTrack()?.id ?? null;
  const { position, duration } = useProgress();
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [seekTarget, setSeekTarget] = useState<number | null>(null);
  const [seekTrackId, setSeekTrackId] = useState(trackId);

  // Adjust-state-during-render: a new track invalidates any drag or pending
  // seek — the old target would otherwise stay on screen until the new
  // track happened to reach it.
  if (seekTrackId !== trackId) {
    setSeekTrackId(trackId);
    setDragValue(null);
    setSeekTarget(null);
  }

  // Adjust-state-during-render: the tick that catches up to the seek target
  // hands the thumb back to the engine. The guard keeps this from looping.
  if (
    seekTarget !== null &&
    Math.abs(position - seekTarget) < SEEK_SETTLE_SECONDS
  ) {
    setSeekTarget(null);
  }

  const shown = dragValue ?? seekTarget ?? position;
  const hasDuration = duration > 0;

  return (
    <View>
      <Slider
        minimumValue={0}
        maximumValue={hasDuration ? duration : 1}
        value={Math.min(shown, hasDuration ? duration : 1)}
        disabled={!hasDuration}
        onSlidingStart={() => setDragValue(position)}
        onValueChange={(value) => setDragValue(value)}
        onSlidingComplete={(value) => {
          setDragValue(null);
          setSeekTarget(value);
          // A failed seek must not hold the thumb on a position the engine
          // never reached — and a late failure must not clear a newer
          // seek's target, so only this seek's own value is cleared.
          seekTo(value).catch(() =>
            setSeekTarget((current) => (current === value ? null : current)),
          );
        }}
        minimumTrackTintColor={colors.brand}
        maximumTrackTintColor={colors.separator}
        thumbTintColor={colors.text}
        accessibilityLabel="Seek within the track"
      />
      <View style={styles.times}>
        <Text variant="caption">{formatTime(shown)}</Text>
        <Text variant="caption">
          {hasDuration ? formatTime(duration) : "--:--"}
        </Text>
      </View>
    </View>
  );
}

/** Seconds as m:ss, or h:mm:ss past the hour. */
function formatTime(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const padded = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${padded}`;
  }
  return `${minutes}:${padded}`;
}

const styles = StyleSheet.create({
  times: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
});
