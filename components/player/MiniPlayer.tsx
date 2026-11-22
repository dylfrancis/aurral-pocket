import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { PlayerArtwork } from "@/components/player/PlayerArtwork";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useCoverColor } from "@/hooks/player/use-cover-color";
import { useSwipeToSkip } from "@/hooks/player/use-swipe-to-skip";
import {
  next,
  togglePlayback,
  useCurrentTrack,
  usePlaybackState,
} from "@/lib/player/player";
import { useColors } from "@/hooks/use-colors";

type MiniPlayerProps = {
  /** Artwork and play/pause only, for the accessory's narrow inline slot. */
  compact?: boolean;
};

/** The row's side padding, which the sliding part runs out to. */
const ROW_PADDING = 12;

/**
 * The mini player's content: artwork, title, play/pause. Tapping the row
 * opens the now-playing screen, and swiping it sideways skips. It reads the
 * player hooks itself — the iOS accessory renders two copies of it, so state
 * must live outside. It never reads progress, so a tick cannot re-render it.
 */
export function MiniPlayer({ compact = false }: MiniPlayerProps) {
  const colors = useColors();
  const router = useRouter();
  const track = useCurrentTrack();
  const state = usePlaybackState();
  // Warms the cache, so the full player opens already tinted.
  useCoverColor(track);
  const [slideWidth, setSlideWidth] = useState(0);
  const swipe = useSwipeToSkip(track, { travel: slideWidth });
  const skipPan = usePanGesture(swipe.panConfig);

  if (!track) return null;

  const isPlaying = state === "playing" || state === "buffering";

  return (
    <GestureDetector gesture={skipPan}>
      <Pressable
        onPress={() => router.push("/now-playing")}
        accessibilityRole="button"
        accessibilityLabel={`${track.title} by ${track.artist}. Open the player.`}
        style={styles.row}
      >
        {/* The slide is clipped at the bar's edge on one side and before
          the buttons on the other. */}
        <View
          style={[styles.slideClip, !compact && styles.slideClipFill]}
          onLayout={(event) => setSlideWidth(event.nativeEvent.layout.width)}
        >
          <Animated.View style={[styles.slide, swipe.style]}>
            <PlayerArtwork
              url={track.artwork}
              coverPath={track.coverPath}
              size={compact ? 32 : 40}
              borderRadius={6}
              onLoad={swipe.onCoverLoad}
            />
            {!compact && (
              <View style={styles.meta}>
                <Text
                  variant="body"
                  numberOfLines={1}
                  style={[Fonts.medium, { color: colors.text }]}
                >
                  {track.title}
                </Text>
                <Text variant="caption" numberOfLines={1}>
                  {track.artist}
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
        <Pressable
          onPress={() => togglePlayback()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          style={styles.control}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={26}
            color={colors.text}
          />
        </Pressable>
        {!compact && (
          <Pressable
            onPress={() => next()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Next track"
            style={styles.control}
          >
            <Ionicons name="play-forward" size={22} color={colors.text} />
          </Pressable>
        )}
      </Pressable>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: ROW_PADDING,
    paddingVertical: 8,
  },
  slideClip: {
    overflow: "hidden",
    marginLeft: -ROW_PADDING,
    paddingLeft: ROW_PADDING,
  },
  slideClipFill: {
    flex: 1,
  },
  slide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  meta: {
    flex: 1,
    gap: 1,
  },
  control: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
