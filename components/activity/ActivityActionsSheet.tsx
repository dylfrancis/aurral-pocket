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
import { useCancelAurralAlbum } from "@/hooks/activity/use-cancel-aurral-album";
import { useDeleteAlbumRequest } from "@/hooks/activity/use-delete-album-request";
import { useResearchAlbum } from "@/hooks/activity/use-research-album";
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
              {request.albumName}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {request.artistName}
            </Text>
          </View>
        )}

        {canResearch && (
          <Pressable
            onPress={handleResearch}
            disabled={researchMutation.isPending}
            style={({ pressed }) => [
              styles.action,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            {researchMutation.isPending ? (
              <ActivityIndicator size={18} color={colors.brand} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.brand} />
            )}
            <Text variant="body" style={{ color: colors.brand }}>
              Re-search
            </Text>
          </Pressable>
        )}

        {canStop && (
          <Pressable
            onPress={handleStop}
            disabled={isStopping}
            style={({ pressed }) => [
              styles.action,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            {isStopping ? (
              <ActivityIndicator size={18} color={colors.error} />
            ) : (
              <Ionicons
                name="close-circle-outline"
                size={18}
                color={colors.error}
              />
            )}
            <Text variant="body" style={{ color: colors.error }}>
              Stop Download
            </Text>
          </Pressable>
        )}
      </BottomSheetView>
    </AppSheet>
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
