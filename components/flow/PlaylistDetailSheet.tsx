import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlashList,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { TrackRow } from "./TrackRow";
import {
  useDeleteSharedPlaylist,
  useDeleteSharedPlaylistTrack,
  useFlowAudioPreview,
  useJobsForPlaylist,
  usePlaylistStats,
  useRetryCyclePaused,
  useSetRetryCyclePaused,
  useSharedPlaylist,
} from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { FlowJob } from "@/lib/types/flow";

type Props = {
  sheetRef: React.RefObject<BottomSheet | null>;
  playlistId: string | null;
  onClose: () => void;
};

export function PlaylistDetailSheet({ sheetRef, playlistId, onClose }: Props) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const playlist = useSharedPlaylist(playlistId ?? undefined);
  const stats = usePlaylistStats(playlistId ?? undefined);
  const jobs = useJobsForPlaylist(playlistId ?? undefined);
  const retryPaused = useRetryCyclePaused(playlistId ?? undefined);
  const { stop } = useFlowAudioPreview();

  const deletePlaylist = useDeleteSharedPlaylist();
  const deleteTrack = useDeleteSharedPlaylistTrack();
  const setRetryPaused = useSetRetryCyclePaused();

  const dismiss = useCallback(() => {
    sheetRef.current?.close();
  }, [sheetRef]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const handleEdit = () => {
    if (!playlist) return;
    dismiss();
    router.push({
      pathname: "/(app)/(tabs)/(flow)/playlist-edit",
      params: { id: playlist.id },
    });
  };

  const handleDelete = () => {
    if (!playlist) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Playlist",
      `Remove "${playlist.name}"? Its files will be cleaned up.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deletePlaylist.mutate(playlist.id, {
              onSuccess: () => {
                stop();
                dismiss();
              },
            }),
        },
      ],
    );
  };

  const handleToggleRetryPaused = () => {
    if (!playlist) return;
    setRetryPaused.mutate({
      playlistId: playlist.id,
      paused: !retryPaused,
    });
  };

  const handleRemoveTrack = useCallback(
    (job: FlowJob) => {
      if (!playlist) return;
      if (job.status !== "done") return;
      Alert.alert(
        "Remove Track",
        `Remove "${job.trackName}" from "${playlist.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () =>
              deleteTrack.mutate({
                playlistId: playlist.id,
                jobId: job.id,
              }),
          },
        ],
      );
    },
    [deleteTrack, playlist],
  );

  const renderItem = useCallback(
    ({ item }: { item: FlowJob }) => (
      <TrackRow job={item} onLongPress={() => handleRemoveTrack(item)} />
    ),
    [handleRemoveTrack],
  );

  const subtitle = useMemo(() => {
    if (!playlist || !stats) return "";
    const total = stats.total || playlist.trackCount;
    return `${stats.done}/${total} ready`;
  }, [playlist, stats]);

  const renderHeader = () => {
    if (!playlist) return null;
    return (
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <Text
              variant="title"
              numberOfLines={1}
              style={[styles.title, { color: colors.text }]}
            >
              {playlist.name}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {subtitle}
              {playlist.sourceName ? ` · from ${playlist.sourceName}` : ""}
            </Text>
          </View>
          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.brandMuted,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            accessibilityLabel="Edit playlist"
          >
            <Ionicons name="pencil" size={18} color={colors.brandStrong} />
          </Pressable>
        </View>

        <View style={[styles.actions, { borderColor: colors.separator }]}>
          <ActionRow
            icon={retryPaused ? "play-outline" : "pause-outline"}
            label={retryPaused ? "Resume Retry" : "Pause Retry"}
            color={colors.text}
            loading={setRetryPaused.isPending}
            onPress={handleToggleRetryPaused}
          />
          <ActionRow
            icon="trash-outline"
            label="Delete Playlist"
            color={colors.error}
            loading={deletePlaylist.isPending}
            onPress={handleDelete}
          />
        </View>

        <Text
          variant="subtitle"
          style={[
            styles.tracksHeader,
            { color: colors.text, fontFamily: Fonts.semiBold },
          ]}
        >
          Tracks
        </Text>
        <Text
          variant="caption"
          style={[styles.tracksHint, { color: colors.subtle }]}
        >
          Long-press a ready track to remove it.
        </Text>
      </View>
    );
  };

  const renderEmpty = useCallback(
    () => (
      <View style={styles.empty}>
        <Text variant="caption">No tracks yet.</Text>
      </View>
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["90%"]}
      enablePanDownToClose
      enableDynamicSizing={false}
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      {playlist ? (
        <BottomSheetFlashList
          data={jobs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        />
      ) : null}
    </BottomSheet>
  );
}

function ActionRow({
  icon,
  label,
  color,
  loading,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.actionRow,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {loading ? (
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
  headerWrap: {
    paddingTop: 8,
    paddingBottom: 8,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: Fonts.bold,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  tracksHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  tracksHint: {
    paddingHorizontal: 16,
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
});
