import { StyleSheet, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { CollectionArtwork } from "./CollectionArtwork";
import { SavedMark } from "@/components/offline/SavedMark";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
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
  const progress = progressLabel(stats, playlist.trackCount);

  return (
    <Card onPress={onPress} bordered pressedOpacity={0.85} style={styles.card}>
      <CollectionArtwork
        collection={playlist}
        kind="playlist"
        stats={stats}
        size={60}
        radius={10}
      />
      <View style={styles.body}>
        <Text
          variant="subtitle"
          numberOfLines={1}
          style={[styles.title, { color: colors.text }]}
        >
          {playlist.name}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {playlist.trackCount} track{playlist.trackCount === 1 ? "" : "s"}
          {playlist.sourceName ? ` · from ${playlist.sourceName}` : ""}
        </Text>
        <View style={styles.chipRow}>
          <Chip label="Playlist" icon="albums-outline" variant="brand" />
          <SavedMark kind="playlist" id={playlist.id} size={16} />
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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
    alignItems: "center",
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...Fonts.semiBold,
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
