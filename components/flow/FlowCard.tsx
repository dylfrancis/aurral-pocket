import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { MixBar } from "./MixBar";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { Flow, PlaylistStats } from "@/lib/types/flow";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  flow: Flow;
  stats?: PlaylistStats;
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

function progressLabel(stats?: PlaylistStats): string | null {
  if (!stats || stats.total === 0) return null;
  return `${stats.done}/${stats.total} ready`;
}

export function FlowCard({ flow, stats, onPress, onToggleEnabled }: Props) {
  const colors = Colors[useColorScheme()];
  const progress = progressLabel(stats);

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
      <View style={styles.header}>
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
          trackColor={{ false: colors.separator, true: colors.brand }}
          thumbColor={colors.surfaceElevated}
          ios_backgroundColor={colors.separator}
        />
      </View>

      <MixBar mix={flow.mix} />

      <View style={styles.footer}>
        <View style={styles.chips}>
          <Chip label={`Discover ${flow.mix.discover}%`} variant="brand" />
          <Chip label={`Mix ${flow.mix.mix}%`} />
          <Chip label={`Trend ${flow.mix.trending}%`} />
          {flow.deepDive ? (
            <Chip label="Deep Dive" icon="layers-outline" variant="brand" />
          ) : null}
        </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
    gap: 6,
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
