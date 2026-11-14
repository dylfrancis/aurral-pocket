import { useCallback, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import FilterList from "@expo/material-symbols/filter_list.xml";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { ActivityActionsSheet } from "@/components/activity/ActivityActionsSheet";
import { EmptyState } from "@/components/library/EmptyState";
import { PillRow } from "@/components/ui/PillRow";
import {
  useActivitySuspense,
  useRefreshActivity,
} from "@/hooks/activity/use-activity";
import { useActivityDownloadStatuses } from "@/hooks/activity/use-activity-download-statuses";
import { useActivityFilter } from "@/hooks/activity/use-activity-view";
import { useActivityJobControls } from "@/hooks/activity/use-activity-job-controls";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useOpenPlaylist } from "@/hooks/flow/use-open-playlist";
import { useNavigateToTab } from "@/hooks/use-navigate-to-tab";
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
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

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
  const navigateToTab = useNavigateToTab();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [selected, setSelected] = useState<ActivityItem | null>(null);

  const { data: items, refetch } = useActivitySuspense();
  const refreshActivity = useRefreshActivity();
  const { data: downloadStatuses } = useActivityDownloadStatuses(items);
  const {
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    statusOptions,
    allCount,
    visible,
  } = useActivityFilter(items, view);
  const counts = getActivityCounts(items);
  const downloadEntryFor = useCallback(
    (item: ActivityItem) => {
      const key = activityStatusKey(item);
      return key ? downloadStatuses?.[key] : undefined;
    },
    [downloadStatuses],
  );

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const { refreshing, onRefresh } = usePullToRefresh(
    refreshActivity,
    "Couldn't refresh activity",
  );

  // Other history entries stay read-only: artist_added rows look actionable,
  // but DELETE /requests/:mbid removes the artist from Lidarr entirely.
  const jobControlsFor = useActivityJobControls();
  const rowHasActions = useCallback(
    (item: ActivityItem) => {
      if (jobControlsFor(item)) return true;
      const albumStatus = downloadEntryFor(item)?.status;
      if (aurralRequestAlbumId(item)) {
        return isActiveAurralStatus(albumStatus) && hasPermission("addAlbum");
      }
      if (!isAlbumRequest(item) || !item.albumId) return false;
      const isFailed = albumStatus === "failed" || item.status === "failed";
      const canStop = item.inQueue && hasPermission("deleteAlbum");
      return canStop || isFailed;
    },
    [jobControlsFor, downloadEntryFor, hasPermission],
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
        // An artist no longer in the library opens the Browse page, which
        // takes its title from the route.
        const name = item.artistName ?? "";
        return () =>
          router.push({ pathname: "/artist/[mbid]", params: { mbid, name } });
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

  // The feed polls while the sheet is open, so it offers what the entry
  // allows now, not what it allowed when it was pressed.
  const sheetItem = selected
    ? (items.find((item) => item.id === selected.id) ?? selected)
    : null;
  const activeStatus = sheetItem
    ? downloadEntryFor(sheetItem)?.status
    : undefined;

  // A lone All pill, or a row of zeros over the empty state, filters nothing.
  const statusPills =
    statusOptions.length > 0 && (allCount > 0 || statusFilter) ? (
      <View style={styles.statusPills}>
        <PillRow
          items={[
            { id: "all", label: "All", count: allCount },
            ...statusOptions,
          ]}
          selected={statusFilter ?? "all"}
          onSelect={(id) => setStatusFilter(id === "all" ? null : id)}
        />
      </View>
    ) : null;
  const showDiscoverAction = view === "history" && !statusFilter;

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
        ListHeaderComponent={statusPills}
        ListEmptyComponent={
          <EmptyState
            icon="musical-notes-outline"
            message={
              statusFilter ? "No matches" : ACTIVITY_EMPTY_STATES[view].message
            }
            actionLabel={showDiscoverAction ? "Start Discovering" : undefined}
            onAction={
              showDiscoverAction
                ? () => navigateToTab("/(app)/(tabs)/(discover)")
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
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
      />
      <ActivityActionsSheet
        sheetRef={sheetRef}
        request={sheetItem}
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
  // The pills scroll edge to edge, past the list's padding.
  statusPills: {
    marginHorizontal: -LIST_PADDING_HORIZONTAL,
    paddingBottom: 8,
  },
});
