import { useCallback, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import FilterList from "@expo/material-symbols/filter_list.xml";
import * as Burnt from "burnt";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { ActivityActionsSheet } from "@/components/activity/ActivityActionsSheet";
import { EmptyState } from "@/components/library/EmptyState";
import {
  useActivitySuspense,
  useRefreshActivity,
} from "@/hooks/activity/use-activity";
import { useActivityDownloadStatuses } from "@/hooks/activity/use-activity-download-statuses";
import { useActivityFilter } from "@/hooks/activity/use-activity-view";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import {
  historyArtistMbid,
  isAlbumRequest,
  type ActivityItem,
  type AlbumRequest,
} from "@/lib/types/activity";
import {
  ACTIVITY_EMPTY_STATES,
  ACTIVITY_TYPES,
  ACTIVITY_VIEWS,
  getActivityCounts,
  type ActivityView,
} from "@/lib/activity-views";

const LIST_PADDING_HORIZONTAL = 16;
const LIST_PADDING_VERTICAL = 12;

type ActivityListProps = {
  view: ActivityView;
};

/**
 * One view of the activity feed. Every tab renders this with a different
 * `view`; they share a single query cache entry, so the extra mounts do not
 * cost extra requests.
 */
export function ActivityList({ view }: ActivityListProps) {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const hasPermission = useHasPermission();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [selected, setSelected] = useState<AlbumRequest | null>(null);

  const { data: items, refetch } = useActivitySuspense();
  const refreshActivity = useRefreshActivity();
  const { data: downloadStatuses } = useActivityDownloadStatuses(items);
  const { typeFilter, setTypeFilter, visible } = useActivityFilter(items, view);
  const counts = getActivityCounts(items);

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
    (item: ActivityItem) => {
      const mbid = isAlbumRequest(item)
        ? item.artistMbid
        : historyArtistMbid(item);
      if (mbid) {
        router.push({ pathname: "/artist/[mbid]", params: { mbid } });
        return;
      }
      // History entries for playlist work carry a playlistId; send those to the
      // flow tab rather than leaving the row inert.
      if (!isAlbumRequest(item) && item.playlistId) {
        router.push("/(app)/(tabs)/(flow)");
      }
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
        onPress={() => handleRowPress(item)}
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
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={
            process.env.EXPO_OS === "ios"
              ? "line.3.horizontal.decrease"
              : FilterList
          }
          title="Filters"
          accessibilityLabel="Filter activity"
        >
          <Stack.Toolbar.Menu inline title="View">
            {ACTIVITY_VIEWS.map((entry) => (
              <Stack.Toolbar.MenuAction
                key={entry.id}
                isOn={view === entry.id}
                onPress={() => router.replace(`/${entry.id}`)}
              >
                {counts[entry.id]
                  ? `${entry.label} (${counts[entry.id]})`
                  : entry.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu inline title="Show">
            {ACTIVITY_TYPES.map((entry) => (
              <Stack.Toolbar.MenuAction
                key={entry.id}
                isOn={typeFilter === entry.id}
                onPress={() => setTypeFilter(entry.id)}
              >
                {entry.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlashList
        data={visible}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={
          <EmptyState
            icon="musical-notes-outline"
            message={ACTIVITY_EMPTY_STATES[view].message}
            actionLabel={view === "history" ? "Start Discovering" : undefined}
            onAction={
              view === "history"
                ? () => router.push("/(app)/(tabs)/(discover)")
                : undefined
            }
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

function ItemSeparator() {
  return <View style={{ height: 8 }} />;
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: LIST_PADDING_HORIZONTAL,
    paddingVertical: LIST_PADDING_VERTICAL,
  },
});
