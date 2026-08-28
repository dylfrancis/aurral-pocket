import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlayerArtwork } from "@/components/player/PlayerArtwork";
import { Scrubber } from "@/components/player/Scrubber";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  next,
  playQueueItem,
  previous,
  setRepeatMode,
  setShuffle,
  togglePlayback,
  useCurrentTrack,
  usePlaybackState,
  usePlayerModes,
  useQueue,
  type RepeatMode,
} from "@/lib/player/player";
import type { PlayerTrack } from "@/lib/player/track-item";

/** Each repeat tap steps to the next mode: queue, then track, then off. */
const NEXT_REPEAT_MODE: Record<RepeatMode, RepeatMode> = {
  off: "all",
  all: "one",
  one: "off",
};

/**
 * The full player, presented as a sheet over the tabs. Progress lives in
 * the Scrubber alone; everything else here reads track, state, queue, and
 * modes, so a progress tick re-renders nothing but the scrubber.
 */
export function NowPlayingScreen() {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const track = useCurrentTrack();
  const state = usePlaybackState();
  const modes = usePlayerModes();
  const { items, currentId } = useQueue();

  const isPlaying = state === "playing" || state === "buffering";
  const upNext = items.slice(items.findIndex((it) => it.id === currentId) + 1);

  const renderUpNextRow = useCallback(
    ({ item }: { item: PlayerTrack }) => <UpNextRow item={item} />,
    [],
  );

  if (!track) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Text variant="subtitle">Nothing is playing.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <PlayerArtwork url={track.artwork} size={280} borderRadius={12} />
        <View style={styles.titles}>
          <Text
            variant="subtitle"
            numberOfLines={1}
            style={[Fonts.medium, { color: colors.text, fontSize: 20 }]}
          >
            {track.title}
          </Text>
          <Text variant="caption" numberOfLines={1} style={{ fontSize: 15 }}>
            {track.artist} — {track.album}
          </Text>
        </View>
        <View style={styles.scrubber}>
          <Scrubber />
        </View>
        <View style={styles.transport}>
          <Pressable
            onPress={() => setShuffle(!modes.shuffle)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: modes.shuffle }}
            accessibilityLabel="Shuffle"
          >
            <Ionicons
              name="shuffle"
              size={24}
              color={modes.shuffle ? colors.brand : colors.subtle}
            />
          </Pressable>
          <Pressable
            onPress={() => previous()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous track"
          >
            <Ionicons name="play-skip-back" size={32} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => togglePlayback()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
          >
            <Ionicons
              name={isPlaying ? "pause-circle" : "play-circle"}
              size={72}
              color={colors.text}
            />
          </Pressable>
          <Pressable
            onPress={() => next()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next track"
          >
            <Ionicons name="play-skip-forward" size={32} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => setRepeatMode(NEXT_REPEAT_MODE[modes.repeat])}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: modes.repeat !== "off" }}
            accessibilityLabel={`Repeat: ${modes.repeat}`}
          >
            {modes.repeat === "one" ? (
              <MaterialIcons name="repeat-one" size={24} color={colors.brand} />
            ) : (
              <Ionicons
                name="repeat"
                size={24}
                color={modes.repeat === "all" ? colors.brand : colors.subtle}
              />
            )}
          </Pressable>
        </View>
      </View>

      <SectionHeader title="Up Next" />
      {/* A core FlatList, not FlashList: FlashList v2 sizes itself against
          the sheet mid-presentation and leaves a gap above the first row
          until the first scroll. The queue is one album, so virtualization
          is not needed here. */}
      <FlatList
        data={upNext}
        renderItem={renderUpNextRow}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ListEmptyComponent={
          <Text variant="caption" style={styles.upNextEmpty}>
            Nothing up next.
          </Text>
        }
      />
    </View>
  );
}

function UpNextRow({ item }: { item: PlayerTrack }) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={() => playQueueItem(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Play ${item.title} by ${item.artist}`}
      style={({ pressed }) => [
        styles.upNextRow,
        { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <PlayerArtwork url={item.artwork} size={44} borderRadius={6} />
      <View style={styles.upNextMeta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[Fonts.medium, { color: colors.text }]}
        >
          {item.title}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    paddingTop: 32,
    paddingHorizontal: 24,
    gap: 20,
  },
  titles: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 4,
  },
  scrubber: {
    alignSelf: "stretch",
  },
  transport: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  upNextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  upNextMeta: {
    flex: 1,
    gap: 2,
  },
  upNextEmpty: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});
