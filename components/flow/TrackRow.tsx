import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { StatusBadge } from "./StatusBadge";
import { useFlowAudioPreview } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { FlowJob } from "@/lib/types/flow";

type Props = {
  job: FlowJob;
  onLongPress?: () => void;
};

export function TrackRow({ job, onLongPress }: Props) {
  const colors = Colors[useColorScheme()];
  const { activeJobId, isPlaying, toggle } = useFlowAudioPreview();
  const isActive = activeJobId === job.id;
  const playable = job.status === "done";

  const handlePress = () => {
    if (!playable) return;
    toggle(job.id);
  };

  const subtitle = job.albumName
    ? `${job.artistName} · ${job.albumName}`
    : job.artistName;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      disabled={!playable && !onLongPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.separator },
        pressed && playable ? { opacity: 0.6 } : null,
      ]}
    >
      <View style={[styles.leading, { backgroundColor: colors.brandMuted }]}>
        {playable ? (
          <Ionicons
            name={isActive && isPlaying ? "pause" : "play"}
            size={16}
            color={colors.brandStrong}
          />
        ) : (
          <Ionicons name="musical-note" size={16} color={colors.subtle} />
        )}
      </View>
      <View style={styles.body}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[
            styles.title,
            isActive ? { color: colors.brandStrong } : { color: colors.text },
          ]}
        >
          {job.trackName}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <StatusBadge status={job.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leading: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: Fonts.medium,
  },
});
