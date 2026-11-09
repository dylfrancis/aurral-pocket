import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { AppSheet } from "@/components/ui/AppSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useActivityJobControls } from "@/hooks/activity/use-activity-job-controls";
import { useCancelAurralAlbum } from "@/hooks/activity/use-cancel-aurral-album";
import { useDeleteAlbumRequest } from "@/hooks/activity/use-delete-album-request";
import { useResearchAlbum } from "@/hooks/activity/use-research-album";
import {
  confirmStopDownload,
  useRetryTrackDownload,
  useStopTrackDownload,
} from "@/hooks/flow/use-track-job-controls";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { isActiveAurralStatus } from "@/lib/album-status";
import type { DownloadStatusValue } from "@/lib/types/library";
import {
  aurralRequestAlbumId,
  isAlbumRequest,
  type ActivityItem,
} from "@/lib/types/activity";

type RequestActionsSheetProps = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  request: ActivityItem | null;
  downloadStatus?: DownloadStatusValue;
};

export function ActivityActionsSheet({
  sheetRef,
  request,
  downloadStatus,
}: RequestActionsSheetProps) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const hasPermission = useHasPermission();
  const deleteMutation = useDeleteAlbumRequest();
  const cancelMutation = useCancelAurralAlbum();
  const researchMutation = useResearchAlbum();
  const stopTrackMutation = useStopTrackDownload();
  const retryTrackMutation = useRetryTrackDownload();
  const jobControlsFor = useActivityJobControls();

  const trackJob = request ? jobControlsFor(request) : null;

  const lidarrRequest = request && isAlbumRequest(request) ? request : null;
  const aurralAlbumId = request ? aurralRequestAlbumId(request) : null;
  const canStop = aurralAlbumId
    ? isActiveAurralStatus(downloadStatus) && hasPermission("addAlbum")
    : !!lidarrRequest?.inQueue &&
      !!lidarrRequest.albumId &&
      hasPermission("deleteAlbum");
  const isStopping = deleteMutation.isPending || cancelMutation.isPending;
  const isFailed =
    downloadStatus === "failed" || lidarrRequest?.status === "failed";
  const canResearch = !!lidarrRequest?.albumId && isFailed;

  const close = () => sheetRef.current?.dismiss();

  const stopDownload = () => {
    // Dismissing an Aurral request would leave its album downloading.
    if (aurralAlbumId) {
      cancelMutation.mutate(aurralAlbumId, { onSettled: close });
    } else if (lidarrRequest?.albumId) {
      deleteMutation.mutate(String(lidarrRequest.albumId), {
        onSettled: close,
      });
    }
  };

  const handleStop = () => {
    if (!request || !canStop) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Stop Download",
      `Stop downloading "${request.albumName ?? "this album"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Stop", style: "destructive", onPress: stopDownload },
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

  const handleResearch = () => {
    if (!lidarrRequest?.albumId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    researchMutation.mutate(String(lidarrRequest.albumId), {
      onSettled: close,
    });
  };

  return (
    <AppSheet ref={sheetRef} enablePanDownToClose enableDynamicSizing>
      <BottomSheetView
        style={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      >
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

        {canResearch && (
          <SheetAction
            icon="refresh"
            label="Re-search"
            color={colors.brand}
            pending={researchMutation.isPending}
            onPress={handleResearch}
          />
        )}

        {canStop && (
          <SheetAction
            icon="close-circle-outline"
            label="Stop Download"
            color={colors.error}
            pending={isStopping}
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
      </BottomSheetView>
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
