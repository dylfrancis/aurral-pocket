import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { StatusBadge } from "./StatusBadge";
import { useFlowAudioPreview, useQueueTrackQualityUpgrade } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { ApiError } from "@/lib/api/client";
import { isUpgradeCandidate, type FlowJob } from "@/lib/types/flow";

type Props = {
  job: FlowJob;
  onLongPress?: () => void;
};

export function TrackRow({ job, onLongPress }: Props) {
  const colors = Colors[useColorScheme()];
  const { activeJobId, isPlaying, progress, toggle } = useFlowAudioPreview();
  const queueUpgrade = useQueueTrackQualityUpgrade();
  const isActive = activeJobId === job.id;
  const playable = job.status === "done";

  const handlePress = () => {
    if (!playable) return;
    toggle(job.id);
  };

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    queueUpgrade.mutate(
      { playlistId: job.playlistType, jobId: job.id },
      {
        onSuccess: (outcome) => {
          Burnt.toast({
            title:
              outcome === "already-queued"
                ? "Upgrade already queued"
                : "Upgrade queued",
            preset: "done",
          });
        },
        onError: (error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Burnt.toast({
            title:
              error instanceof ApiError && error.status === 409
                ? "No upgrade available for this track"
                : "Couldn't queue the upgrade",
            preset: "error",
          });
        },
      },
    );
  };

  const subtitle = job.albumName
    ? `${job.artistName} · ${job.albumName}`
    : job.artistName;

  // "Unknown" is the server's fallback when it could not classify the file;
  // showing it adds noise without information.
  const qualityKnown = !!job.qualityLabel && job.qualityLabel !== "Unknown";
  const qualityColor =
    job.qualityState === "preferred" ? colors.brand : colors.subtle;

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
        {isActive && isPlaying ? (
          <View
            style={[styles.progressBar, { backgroundColor: colors.separator }]}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%`, backgroundColor: colors.brand },
              ]}
            />
          </View>
        ) : null}
      </View>
      {qualityKnown ? (
        <View
          style={[
            styles.qualityBadge,
            { backgroundColor: `${qualityColor}20` },
          ]}
        >
          <Text
            variant="caption"
            style={[styles.qualityText, { color: qualityColor }]}
          >
            {job.qualityLabel}
          </Text>
        </View>
      ) : null}
      <StatusBadge status={job.status} />
      {isUpgradeCandidate(job) ? (
        <Pressable
          onPress={handleUpgrade}
          disabled={queueUpgrade.isPending}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Search for a quality upgrade of ${job.trackName}`}
          style={({ pressed }) => [pressed ? { opacity: 0.6 } : null]}
        >
          {queueUpgrade.isPending ? (
            <ActivityIndicator size={18} color={colors.brand} />
          ) : (
            <Ionicons
              name="arrow-up-circle-outline"
              size={20}
              color={colors.brand}
            />
          )}
        </Pressable>
      ) : null}
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
    ...Fonts.medium,
  },
  qualityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  qualityText: {
    fontSize: 10,
    ...Fonts.medium,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    marginTop: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1,
  },
});
