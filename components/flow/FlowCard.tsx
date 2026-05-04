import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { MixPills } from "./MixPills";
import { ProgressBar } from "./ProgressBar";
import { FlowArtwork } from "./FlowArtwork";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { getFlowArtworkUrl } from "@/lib/api/flow";
import type { Flow, PlaylistStats } from "@/lib/types/flow";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  flow: Flow;
  stats?: PlaylistStats;
  isDeleting?: boolean;
  onPress: () => void;
  onToggleEnabled: (enabled: boolean) => void;
};

function scheduleLabel(flow: Flow): string {
  if (!flow.scheduleDays?.length) return "Manual";
  const days = flow.scheduleDays
    .map((d) => DAY_LABELS[d] ?? "")
    .filter(Boolean);
  return `${days.join(", ")} · ${flow.scheduleTime}`;
}

function progressLabel(
  stats: PlaylistStats | undefined,
  target: number,
): string | null {
  if (target <= 0) return null;
  const done = Math.max(0, Math.min(stats?.done ?? 0, target));
  return `${done}/${target} ready`;
}

export function FlowCard({
  flow,
  stats,
  isDeleting,
  onPress,
  onToggleEnabled,
}: Props) {
  const colors = Colors[useColorScheme()];
  const { token } = useAuth();
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const artworkUrl = getFlowArtworkUrl(flow.id, token);
  const progress = progressLabel(stats, flow.size);

  // Retry image load when polling picks up new stats — the backend writes the
  // artwork PNG when a flow first runs, so a stats change is a good signal
  // that the previously-404'd URL is now valid.
  const statsKey = stats ? `${stats.done}-${stats.total}` : "none";
  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);
  }, [statsKey]);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDeleting}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.separator,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.artwork, { borderColor: colors.separator }]}>
          <FlowArtwork name={flow.name} kind="flow" size={60} radius={10} />
          {!imageFailed ? (
            <Image
              source={{ uri: artworkUrl }}
              style={[
                StyleSheet.absoluteFill,
                { opacity: imageLoaded ? 1 : 0 },
              ]}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
            />
          ) : null}
        </View>
        <View style={styles.titleGroup}>
          <Text
            variant="subtitle"
            numberOfLines={1}
            style={[styles.title, { color: colors.text }]}
          >
            {flow.name}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {flow.size} tracks · {scheduleLabel(flow)}
          </Text>
        </View>
        <Switch
          value={flow.enabled}
          onValueChange={onToggleEnabled}
          disabled={isDeleting}
          trackColor={{ false: colors.separator, true: colors.brand }}
          thumbColor={colors.switchThumb}
          ios_backgroundColor={colors.separator}
        />
      </View>

      <ProgressBar done={stats?.done ?? 0} total={flow.size} />

      <View style={styles.footer}>
        <View style={styles.chips}>
          <Chip label="Flow" icon="repeat" variant="brand" />
          <MixPills mix={flow.mix} />
          {flow.deepDive ? (
            <Chip label="Deep Dive" icon="layers-outline" variant="brand" />
          ) : null}
        </View>
        {isDeleting ? (
          <View style={styles.progress}>
            <ActivityIndicator size="small" color={colors.error} />
            <Text variant="caption" style={{ color: colors.error }}>
              Cleaning existing flow files…
            </Text>
          </View>
        ) : progress ? (
          <View style={styles.progress}>
            <Ionicons
              name="cloud-download-outline"
              size={14}
              color={colors.subtle}
            />
            <Text variant="caption">{progress}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  artwork: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 17,
  },
  footer: {
    gap: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
