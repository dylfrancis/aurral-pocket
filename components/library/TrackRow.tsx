import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePlaybackState, useCurrentTrack } from "@/lib/player/player";
import { Colors, Fonts } from "@/constants/theme";
import type { Track } from "@/lib/types/library";

const BAR_MIN = 3;
const BAR_MAX = 12;
/** Staggered so the three bars never move in lockstep. */
const BAR_DURATIONS = [420, 520, 360];

type TrackRowProps = {
  track: Track;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Opens the track's action sheet. Omitted, the row shows no menu button. */
  onMenuPress?: () => void;
};

export const TrackRow = React.memo(function TrackRow({
  track,
  onPress,
  onLongPress,
  onMenuPress,
}: TrackRowProps) {
  const colors = Colors[useColorScheme()];

  // The engine addresses tracks by string id, so the comparison matches how
  // the queue itself identifies them.
  const currentId = useCurrentTrack()?.id ?? null;
  const playbackState = usePlaybackState();
  const isCurrent = currentId != null && currentId === String(track.id);

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
        pressed && interactive ? { opacity: 0.6 } : null,
      ]}
    >
      {/* Always rendered, so titles do not shift when playback moves. */}
      <View style={styles.indicator}>
        {isCurrent && (
          <PlayingBars
            animating={playbackState === "playing"}
            color={colors.brand}
          />
        )}
      </View>
      <Text
        variant="body"
        numberOfLines={1}
        style={[styles.title, isCurrent && { color: colors.brand }]}
      >
        {track.trackName}
      </Text>
      {track.hasFile && track.quality && (
        <View
          style={[
            styles.qualityBadge,
            { backgroundColor: `${colors.brand}20` },
          ]}
        >
          <Text
            variant="caption"
            style={[styles.qualityText, { color: colors.brand }]}
          >
            {track.quality}
          </Text>
        </View>
      )}
      <Ionicons
        name={track.hasFile ? "checkmark-circle" : "remove-circle-outline"}
        size={16}
        color={track.hasFile ? colors.brand : colors.subtle}
      />
      {onMenuPress && (
        <Pressable
          onPress={onMenuPress}
          // The row is only 40pt tall, so the button borrows the space around
          // it to reach a tappable size.
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${track.trackName}`}
          style={({ pressed }) => [
            styles.menuButton,
            { opacity: pressed ? 0.5 : 1 },
          ]}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={colors.subtle}
          />
        </Pressable>
      )}
    </Pressable>
  );
});

/**
 * The three-bar equaliser that marks the track the player is on. Paused
 * holds the bars still at their resting height rather than hiding them, so a
 * paused track still reads as the current one.
 */
function PlayingBars({
  animating,
  color,
}: {
  animating: boolean;
  color: string;
}) {
  return (
    <View style={styles.bars} testID="track-playing-indicator">
      {BAR_DURATIONS.map((duration, index) => (
        <Bar
          key={index}
          duration={duration}
          delay={index * 110}
          animating={animating}
          color={color}
        />
      ))}
    </View>
  );
}

function Bar({
  duration,
  delay,
  animating,
  color,
}: {
  duration: number;
  delay: number;
  animating: boolean;
  color: string;
}) {
  const height = useSharedValue(BAR_MIN);
  // Respecting the OS setting matters more than the flourish: this animation
  // never stops on its own, so it would loop for as long as the page is open.
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!animating || reduceMotion) {
      cancelAnimation(height);
      height.value = withTiming(reduceMotion && animating ? BAR_MAX : BAR_MIN, {
        duration: 150,
      });
      return;
    }
    height.value = withDelay(
      delay,
      withRepeat(withTiming(BAR_MAX, { duration }), -1, true),
    );
    return () => cancelAnimation(height);
  }, [animating, reduceMotion, duration, delay, height]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: color }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  indicator: {
    width: 12,
    height: BAR_MAX,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: BAR_MAX,
    gap: 2,
  },
  bar: {
    width: 2.5,
    borderRadius: 1.5,
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
  menuButton: {
    paddingLeft: 4,
  },
  qualityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  qualityText: {
    fontSize: 10,
    ...Fonts.medium,
  },
});
