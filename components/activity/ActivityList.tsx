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
import { useOpenPlaylist } from "@/hooks/flow/use-open-playlist";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import { isActiveAurralStatus } from "@/lib/album-status";
import {
  activityArtistMbid,
  activityStatusKey,
  aurralRequestAlbumId,
  historyPlaylistId,
  isAlbumRequest,
  type ActivityItem,
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
  const openPlaylist = useOpenPlaylist();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [selected, setSelected] = useState<ActivityItem | null>(null);

  const { data: items, refetch } = useActivitySuspense();
  const refreshActivity = useRefreshActivity();
  const { data: downloadStatuses } = useActivityDownloadStatuses(items);
  const { typeFilter, setTypeFilter, visible } = useActivityFilter(items, view);
  const counts = getActivityCounts(items);
  const downloadEntryFor = useCallback(
    (item: ActivityItem) => {
      const key = activityStatusKey(item);
      return key ? downloadStatuses?.[key] : undefined;
    },
    [downloadStatuses],
  );

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

  // Other history entries stay read-only: artist_added rows look actionable,
  // but DELETE /requests/:mbid removes the artist from Lidarr entirely.
  const rowHasActions = useCallback(
    (item: ActivityItem) => {
      const albumStatus = downloadEntryFor(item)?.status;
      if (aurralRequestAlbumId(item)) {
        return isActiveAurralStatus(albumStatus) && hasPermission("addAlbum");
      }
      if (!isAlbumRequest(item) || !item.albumId) return false;
      const isFailed = albumStatus === "failed" || item.status === "failed";
      const canStop = item.inQueue && hasPermission("deleteAlbum");
      return canStop || isFailed;
    },
    [downloadEntryFor, hasPermission],
  );

  // Playlist links need accessFlow: both lists and the lookup behind them
  // answer 403 without it. A blocked row is skipped because its inline Approve
  // and Deny sit on the row, and a near miss must not navigate away from the
  // decision.
  const canOpenPlaylists = hasPermission("accessFlow");
  const rowPressHandler = useCallback(
    (item: ActivityItem) => {
      const mbid = activityArtistMbid(item);
      if (mbid) {
        return () =>
          router.push({ pathname: "/artist/[mbid]", params: { mbid } });
      }
      if (!canOpenPlaylists || isAlbumRequest(item)) return undefined;
      if (item.status === "blocked") return undefined;
      const playlistId = historyPlaylistId(item);
      return playlistId ? () => void openPlaylist(playlistId) : undefined;
    },
    [router, canOpenPlaylists, openPlaylist],
  );

  const handleLongPress = useCallback((item: ActivityItem) => {
    setSelected(item);
    sheetRef.current?.present();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ActivityItem }) => (
      <ActivityRow
        item={item}
        downloadEntry={downloadEntryFor(item)}
        hasActions={rowHasActions(item)}
        onPress={rowPressHandler(item)}
        onLongPress={() => handleLongPress(item)}
      />
    ),
    [downloadEntryFor, rowHasActions, rowPressHandler, handleLongPress],
  );

  const activeStatus = selected
    ? downloadEntryFor(selected)?.status
    : undefined;

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={IS_IOS ? "line.3.horizontal.decrease" : FilterList}
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
