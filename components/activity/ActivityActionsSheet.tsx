import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { AppSheet, type Sheet } from "@/components/ui/AppSheet";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useActivityJobControls } from "@/hooks/activity/use-activity-job-controls";
import { useCancelAurralAlbum } from "@/hooks/activity/use-cancel-aurral-album";
import {
  confirmStopDownload,
  useRetryTrackDownload,
  useStopTrackDownload,
} from "@/hooks/flow/use-track-job-controls";
import { Fonts } from "@/constants/theme";
import { stoppableAlbumId } from "@/lib/activity-views";
import type { DownloadStatusValue } from "@/lib/types/library";
import type { ActivityItem } from "@/lib/types/activity";
import { useColors } from "@/hooks/use-colors";

type RequestActionsSheetProps = {
  sheet: Sheet;
  request: ActivityItem | null;
  downloadStatus?: DownloadStatusValue;
};

export function ActivityActionsSheet({
  sheet,
  request,
  downloadStatus,
}: RequestActionsSheetProps) {
  const colors = useColors();
  const hasPermission = useHasPermission();
  const cancelMutation = useCancelAurralAlbum();
  const stopTrackMutation = useStopTrackDownload();
  const retryTrackMutation = useRetryTrackDownload();
  const jobControlsFor = useActivityJobControls();

  const trackJob = request ? jobControlsFor(request) : null;

  const libraryAlbumId = request
    ? stoppableAlbumId(request, downloadStatus)
    : null;
  const canStop = !!libraryAlbumId && hasPermission("addAlbum");

  const close = () => sheet.close();

  const handleStop = () => {
    if (!request || !libraryAlbumId || !canStop) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Stop Download",
      `Stop downloading "${request.albumName ?? "this album"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: () =>
            cancelMutation.mutate(libraryAlbumId, { onSettled: close }),
        },
      ],
    );
  };

  const handleRetryTrack = () => {
    if (!trackJob) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    retryTrackMutation.mutate(trackJob.jobId, { onSettled: close });
  };

  const handleStopTrack = () => {
    if (!trackJob) return;
    confirmStopDownload(trackJob.trackName, () =>
      stopTrackMutation.mutate(trackJob.jobId, { onSettled: close }),
    );
  };

  return (
    <AppSheet sheet={sheet}>
      <View style={styles.content}>
        {request && (
          <View style={styles.header}>
            <Text
              variant="subtitle"
              numberOfLines={1}
              style={[styles.title, { color: colors.text }]}
            >
              {trackJob ? trackJob.trackName : request.albumName}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {request.artistName}
            </Text>
          </View>
        )}

        {canStop && (
          <SheetAction
            icon="close-circle-outline"
            label="Stop Download"
            color={colors.error}
            pending={cancelMutation.isPending}
            onPress={handleStop}
          />
        )}

        {trackJob && (
          <SheetAction
            icon="refresh"
            label={trackJob.restarts ? "Restart Download" : "Retry Download"}
            color={colors.brand}
            pending={retryTrackMutation.isPending}
            onPress={handleRetryTrack}
          />
        )}

        {trackJob?.canStop && (
          <SheetAction
            icon="close-circle-outline"
            label="Stop Download"
            color={colors.error}
            pending={stopTrackMutation.isPending}
            onPress={handleStopTrack}
          />
        )}
      </View>
    </AppSheet>
  );
}

function SheetAction({
  icon,
  label,
  color,
  pending,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  pending: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.5 : 1 }]}
    >
      {pending ? (
        <ActivityIndicator size={18} color={color} />
      ) : (
        <Ionicons name={icon} size={18} color={color} />
      )}
      <Text variant="body" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  header: {
    paddingVertical: 8,
    gap: 2,
  },
  title: {
    ...Fonts.semiBold,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
});
