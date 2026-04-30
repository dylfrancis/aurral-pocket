import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { getFlowArtworkUrl } from "@/lib/api/flow";
import type { PlaylistStats, SharedPlaylist } from "@/lib/types/flow";

type Props = {
  playlist: SharedPlaylist;
  stats?: PlaylistStats;
  retryPaused?: boolean;
  onPress: () => void;
};

function progressLabel(
  stats: PlaylistStats | undefined,
  target: number,
): string | null {
  if (target <= 0) return null;
  const done = Math.max(0, Math.min(stats?.done ?? 0, target));
  return `${done}/${target} ready`;
}

export function PlaylistCard({ playlist, stats, retryPaused, onPress }: Props) {
  const colors = Colors[useColorScheme()];
  const { token } = useAuth();
  const artworkUrl = getFlowArtworkUrl(playlist.id, token);
  const progress = progressLabel(stats, playlist.trackCount);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.separator,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.artwork,
          { backgroundColor: colors.brandMuted, borderColor: colors.separator },
        ]}
      >
        <Image
          source={{ uri: artworkUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      </View>
      <View style={styles.body}>
        <Text
          variant="subtitle"
          numberOfLines={1}
          style={[styles.title, { color: colors.text }]}
        >
          {playlist.name}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {playlist.trackCount} tracks
          {playlist.sourceName ? ` · from ${playlist.sourceName}` : ""}
        </Text>
        <View style={styles.chipRow}>
          <Chip label="Playlist" icon="albums-outline" variant="brand" />
          {progress ? (
            <View style={styles.progress}>
              <Ionicons
                name="cloud-download-outline"
                size={14}
                color={colors.subtle}
              />
              <Text variant="caption">{progress}</Text>
            </View>
          ) : null}
          {retryPaused ? (
            <Chip label="Retry paused" icon="pause" variant="subtle" />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 12,
    alignItems: "center",
  },
  artwork: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 17,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
