import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { PlayerArtwork } from "@/components/player/PlayerArtwork";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  next,
  togglePlayback,
  useCurrentTrack,
  usePlaybackState,
} from "@/lib/player/player";

type MiniPlayerProps = {
  /** Artwork and play/pause only, for the accessory's narrow inline slot. */
  compact?: boolean;
};

/**
 * The mini player's content: artwork, title, play/pause. Tapping the row
 * opens the now-playing screen. It reads the player hooks itself — the iOS
 * accessory renders two copies of it, so state must live outside. It never
 * reads progress, so a tick cannot re-render it.
 */
export function MiniPlayer({ compact = false }: MiniPlayerProps) {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const track = useCurrentTrack();
  const state = usePlaybackState();

  if (!track) return null;

  const isPlaying = state === "playing" || state === "buffering";

  return (
    <Pressable
      onPress={() => router.push("/now-playing")}
      accessibilityRole="button"
      accessibilityLabel={`${track.title} by ${track.artist}. Open the player.`}
      style={styles.row}
    >
      <PlayerArtwork
        url={track.artwork}
        size={compact ? 32 : 40}
        borderRadius={6}
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
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
