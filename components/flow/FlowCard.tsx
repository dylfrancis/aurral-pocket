import { StyleSheet, View } from "react-native";
import { Switch } from "@/components/ui/Switch";
import { Card } from "@/components/ui/Card";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { CollectionArtwork } from "./CollectionArtwork";
import { MixPills } from "./MixPills";
import { ProgressBar } from "./ProgressBar";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { scheduleLabel } from "@/lib/flow-schedule";
import type { Flow, PlaylistStats } from "@/lib/types/flow";

type Props = {
  flow: Flow;
  stats?: PlaylistStats;
  onPress: () => void;
  onToggleEnabled: (enabled: boolean) => void;
};

function progressLabel(
  stats: PlaylistStats | undefined,
  target: number,
): string | null {
  if (target <= 0) return null;
  const done = Math.max(0, Math.min(stats?.done ?? 0, target));
  return `${done}/${target} ready`;
}

export function FlowCard({ flow, stats, onPress, onToggleEnabled }: Props) {
  const colors = Colors[useColorScheme()];
  const progress = progressLabel(stats, flow.size);

  return (
    <Card onPress={onPress} bordered pressedOpacity={0.85} style={styles.card}>
      <View style={styles.topRow}>
        <CollectionArtwork
          collection={flow}
          kind="flow"
          stats={stats}
          size={60}
          radius={10}
        />
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
        <Switch value={flow.enabled} onValueChange={onToggleEnabled} />
      </View>

      <ProgressBar done={stats?.done ?? 0} total={flow.size} />

      <View style={styles.footer}>
        <View style={styles.chips}>
          <Chip label="Flow" icon="repeat" variant="brand" />
          <MixPills mix={flow.mix} />
          {flow.deepDive ? (
            <Chip label="Deeper Cuts" icon="layers-outline" variant="brand" />
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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Fonts.semiBold,
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
