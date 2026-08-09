import { useCallback, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  useFocusEffect,
  useRouter,
  type ErrorBoundaryProps,
} from "expo-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import * as Burnt from "burnt";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { ActivityActionsSheet } from "@/components/activity/ActivityActionsSheet";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { EmptyState } from "@/components/library/EmptyState";
import {
  useActivitySuspense,
  useRefreshActivity,
} from "@/hooks/activity/use-activity";
import { useActivityDownloadStatuses } from "@/hooks/activity/use-activity-download-statuses";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import {
  historyArtistMbid,
  isAlbumRequest,
  type ActivityItem,
  type AlbumRequest,
} from "@/lib/types/activity";

const LIST_PADDING_HORIZONTAL = 16;
const LIST_PADDING_VERTICAL = 12;

export default function ActivityScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const hasPermission = useHasPermission();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [selected, setSelected] = useState<AlbumRequest | null>(null);

  const { data: items, refetch } = useActivitySuspense();
  const refreshActivity = useRefreshActivity();
  const { data: downloadStatuses } = useActivityDownloadStatuses(items);

  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      const ok = await refreshActivity();
      if (!ok) {
        Burnt.toast({
          title: "Couldn't refresh activity",
          preset: "error",
        });
      }
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refreshActivity]);

  // Only Lidarr album requests expose safe actions. artist_added rows look
  // actionable but DELETE /requests/:mbid removes the artist from Lidarr
  // entirely, so history entries stay read-only.
  const rowHasActions = useCallback(
    (item: ActivityItem) => {
      if (!isAlbumRequest(item) || !item.albumId) return false;
      const albumStatus = downloadStatuses?.[String(item.albumId)]?.status;
      const isFailed = albumStatus === "failed" || item.status === "failed";
      const canStop = item.inQueue && hasPermission("deleteAlbum");
      return canStop || isFailed;
    },
    [downloadStatuses, hasPermission],
  );

  const handleRowPress = useCallback(
    (mbid: string | null) => {
      if (!mbid) return;
      router.push({ pathname: "/artist/[mbid]", params: { mbid } });
    },
    [router],
  );

  const handleLongPress = useCallback((item: ActivityItem) => {
    if (!isAlbumRequest(item)) return;
    setSelected(item);
    sheetRef.current?.present();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ActivityItem }) => (
      <ActivityRow
        item={item}
        downloadStatus={
          item.albumId
            ? downloadStatuses?.[String(item.albumId)]?.status
            : undefined
        }
        hasActions={rowHasActions(item)}
        onPress={() =>
          handleRowPress(
            isAlbumRequest(item) ? item.artistMbid : historyArtistMbid(item),
          )
        }
        onLongPress={() => handleLongPress(item)}
      />
    ),
    [downloadStatuses, rowHasActions, handleRowPress, handleLongPress],
  );

  const activeStatus = selected?.albumId
    ? downloadStatuses?.[String(selected.albumId)]?.status
    : undefined;

  return (
    <>
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={
          <EmptyState
            icon="musical-notes-outline"
            message="No activity yet"
            actionLabel="Start Discovering"
            onAction={() => router.push("/(app)/(tabs)/(discover)")}
          />
        }
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handlePullRefresh}
            tintColor={colors.brand}
          />
        }
      />
      <ActivityActionsSheet
        sheetRef={sheetRef}
        request={selected}
        downloadStatus={activeStatus}
      />
    </>
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ScreenCenter>
      <EmptyState
        icon="cloud-offline-outline"
        message="Failed to load activity"
        actionLabel="Try Again"
        onAction={() => {
          reset();
          retry();
        }}
      />
    </ScreenCenter>
  );
}

function ItemSeparator() {
  return <View style={{ height: 8 }} />;
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: LIST_PADDING_HORIZONTAL,
    paddingVertical: LIST_PADDING_VERTICAL,
  },
});
