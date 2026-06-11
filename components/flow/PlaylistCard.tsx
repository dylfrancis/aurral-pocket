import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { FlowArtwork } from "./FlowArtwork";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { getFlowArtworkSource } from "@/lib/api/flow";
import type { PlaylistStats, SharedPlaylist } from "@/lib/types/flow";

type Props = {
  playlist: SharedPlaylist;
  stats?: PlaylistStats;
  retryPaused?: boolean;
  isDeleting?: boolean;
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

export function PlaylistCard({
  playlist,
  stats,
  retryPaused,
  isDeleting,
  onPress,
}: Props) {
  const colors = Colors[useColorScheme()];
  const { token } = useAuth();
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const artworkSource = getFlowArtworkSource(playlist.id, token);
  const progress = progressLabel(stats, playlist.trackCount);

  // Retry image load when polling picks up new stats — see FlowCard.
  const statsKey = stats
    ? `${stats.done}-${stats.total}`
    : `count-${playlist.trackCount}`;
  const [prevStatsKey, setPrevStatsKey] = useState(statsKey);
  if (prevStatsKey !== statsKey) {
    setPrevStatsKey(statsKey);
    setImageFailed(false);
    setImageLoaded(false);
  }

  return (
    <Card
      onPress={onPress}
      disabled={isDeleting}
      bordered
      pressedOpacity={0.85}
      style={styles.card}
    >
      <View style={[styles.artwork, { borderColor: colors.separator }]}>
        <FlowArtwork
          name={playlist.name}
          kind="playlist"
          size={60}
          radius={10}
        />
        {!imageFailed ? (
          <Image
            source={artworkSource}
            style={[StyleSheet.absoluteFill, { opacity: imageLoaded ? 1 : 0 }]}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        ) : null}
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
          {isDeleting ? (
            <View style={styles.progress}>
              <ActivityIndicator size="small" color={colors.error} />
              <Text variant="caption" style={{ color: colors.error }}>
                Cleaning playlist files…
              </Text>
            </View>
          ) : (
            <>
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
            </>
          )}
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
