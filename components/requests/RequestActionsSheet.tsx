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
import { useDeleteAlbumRequest } from "@/hooks/requests/use-delete-album-request";
import { useResearchAlbum } from "@/hooks/requests/use-research-album";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { DownloadStatusValue } from "@/lib/types/library";
import type { Request } from "@/lib/types/requests";

type RequestActionsSheetProps = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  request: Request | null;
  downloadStatus?: DownloadStatusValue;
};

export function RequestActionsSheet({
  sheetRef,
  request,
  downloadStatus,
}: RequestActionsSheetProps) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const hasPermission = useHasPermission();
  const deleteMutation = useDeleteAlbumRequest();
  const researchMutation = useResearchAlbum();

  const canStop =
    !!request?.inQueue && !!request?.albumId && hasPermission("deleteAlbum");
  const isFailed = downloadStatus === "failed" || request?.status === "failed";
  const canResearch = !!request?.albumId && isFailed;

  const close = () => sheetRef.current?.dismiss();

  const handleStop = () => {
    if (!request?.albumId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Stop Download", `Stop downloading "${request.albumName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: () => {
          deleteMutation.mutate(String(request.albumId), { onSettled: close });
        },
      },
    ]);
  };

  const handleResearch = () => {
    if (!request?.albumId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    researchMutation.mutate(String(request.albumId), { onSettled: close });
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
            disabled={deleteMutation.isPending}
            style={({ pressed }) => [
              styles.action,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            {deleteMutation.isPending ? (
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
    fontFamily: Fonts.semiBold,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
});
