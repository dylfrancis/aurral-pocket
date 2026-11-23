import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import CancelIcon from "@expo/material-symbols/cancel.xml";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import PauseIcon from "@expo/material-symbols/pause.xml";
import PlayArrow from "@expo/material-symbols/play_arrow.xml";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { ActivityActionsSheet } from "@/components/activity/ActivityActionsSheet";
import { ActivityCauseCards } from "@/components/activity/ActivityCauseCards";
import { EmptyState } from "@/components/library/EmptyState";
import { NO_SCROLL_ANCHOR } from "@/components/library/ReleaseGrid";
import { useSheet } from "@/components/ui/AppSheet";
import { PillRow } from "@/components/ui/PillRow";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/contexts/auth-context";
import {
  useActivityCounts,
  useActivityPages,
} from "@/hooks/activity/use-activity";
import { useActivityDownloadStatuses } from "@/hooks/activity/use-activity-download-statuses";
import { useActivityJobControls } from "@/hooks/activity/use-activity-job-controls";
import {
  useCancelQueuedDownloads,
  usePauseQueue,
} from "@/hooks/activity/use-queue-controls";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useOpenPlaylist } from "@/hooks/flow/use-open-playlist";
import { SettingsToolbar } from "@/components/navigation/SettingsToolbar";
import {
  activityArtistMbid,
  albumRequestLibraryId,
  historyPlaylistId,
  type ActivityItem,
  type ActivityStatus,
} from "@/lib/types/activity";
import {
  ACTIVITY_EMPTY_STATES,
  ACTIVITY_VIEWS,
  describeActivityCause,
  stoppableAlbumId,
  type ActivityView,
} from "@/lib/activity-views";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import {
  FILTER_MENU_ICON,
  menuOptionSection,
} from "@/components/ui/MenuOptions";
import { IS_IOS } from "@/constants/platform";
import { Radius } from "@/constants/theme";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { useColors } from "@/hooks/use-colors";

const LIST_PADDING_HORIZONTAL = 16;
const LIST_PADDING_VERTICAL = 12;

type ActivityListProps = {
  view: ActivityView;
};

/**
 * One view of Aurral's activity. Each view is its own screen, so its status
 * and cause filters are its own.
 */
export function ActivityList({ view }: ActivityListProps) {
  const router = useRouter();
  const openArtist = useOpenArtist();
  const colors = useColors();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const hasPermission = useHasPermission();
  const openPlaylist = useOpenPlaylist();
  const actionsSheet = useSheet();
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | null>(null);
  const [causeFilter, setCauseFilter] = useState<string | null>(null);

  const activity = useActivityPages(view, {
    status: statusFilter,
    cause: causeFilter,
  });
  const { items, page } = activity;
  const counts = useActivityCounts();
  const { data: downloadStatuses } = useActivityDownloadStatuses(items);
  const cancelQueued = useCancelQueuedDownloads();
  const pauseQueue = usePauseQueue();

  // Aurral ignores a cause it no longer has queued, so the filter lets it go
  // too, rather than coming back when a new group takes the same key.
  const appliedCause = page?.cause ?? null;
  if (causeFilter && page && !activity.isPlaceholderData && !appliedCause) {
    setCauseFilter(null);
  }

  const downloadEntryFor = useCallback(
    (item: ActivityItem) => {
      const albumId = albumRequestLibraryId(item);
      return albumId ? downloadStatuses?.[albumId] : undefined;
    },
    [downloadStatuses],
  );

  const { refreshing, onRefresh } = usePullToRefresh(
    activity.refresh,
    "Couldn't refresh activity",
  );

  const jobControlsFor = useActivityJobControls();
  const rowHasActions = useCallback(
    (item: ActivityItem) => {
      if (jobControlsFor(item)) return true;
      return (
        !!stoppableAlbumId(item, downloadEntryFor(item)?.status) &&
        hasPermission("addAlbum")
      );
    },
    [jobControlsFor, downloadEntryFor, hasPermission],
  );

  // Playlist links need accessPlaylists: both lists and the lookup behind them
  // answer 403 without it. A blocked row is skipped because its inline Approve
  // and Deny sit on the row, and a near miss must not navigate away from the
  // decision.
  const canOpenPlaylists = hasPermission("accessPlaylists");
  const rowPressHandler = useCallback(
    (item: ActivityItem) => {
      const mbid = activityArtistMbid(item);
      // An artist no longer in the library opens the Browse page, which
      // takes its title from the route.
      if (mbid) return () => openArtist({ mbid, name: item.artistName ?? "" });
      if (!canOpenPlaylists) return undefined;
      if (item.status === "blocked") return undefined;
      const playlistId = historyPlaylistId(item);
      return playlistId ? () => void openPlaylist(playlistId) : undefined;
    },
    [openArtist, canOpenPlaylists, openPlaylist],
  );

  const presentActions = actionsSheet.present;
  const handleLongPress = useCallback(
    (item: ActivityItem) => {
      setSelected(item);
      presentActions();
    },
    [presentActions],
  );

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

  // The feed updates while the sheet is open, so it offers what the entry
  // allows now, not what it allowed when it was pressed.
  const sheetItem = selected
    ? (items.find((item) => item.id === selected.id) ?? selected)
    : null;
  const activeStatus = sheetItem
    ? downloadEntryFor(sheetItem)?.status
    : undefined;

  const isQueue = view === "queue";
  const paused = isQueue && !!page?.paused;
  const cancelable = isQueue ? (page?.cancelable ?? 0) : 0;
  const causes = isQueue ? (page?.causes ?? []) : [];
  const selectedCause = causes.find((group) => group.key === appliedCause);
  const causeTitle = selectedCause
    ? describeActivityCause(selectedCause).title
    : null;

  const confirmCancel = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const downloads = `${cancelable} ${cancelable === 1 ? "download" : "downloads"}`;
    Alert.alert(
      causeTitle ? `Cancel ${causeTitle} downloads?` : "Cancel all downloads?",
      `${downloads} will stop. You can retry each one from History.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: causeTitle ? "Cancel Downloads" : "Cancel All",
          style: "destructive",
          onPress: () => cancelQueued.mutate(appliedCause),
        },
      ],
    );
  };

  // A lone All pill, or a row of zeros over the empty state, filters nothing.
  // Review is itself a status, so it has none.
  const statusOptions = view === "review" ? [] : (page?.filters ?? []);
  const total = page?.total ?? 0;
  const statusPills =
    statusOptions.length > 0 && (total > 0 || statusFilter) ? (
      <View style={styles.statusPills}>
        <PillRow
          items={[{ id: "all", label: "All", count: total }, ...statusOptions]}
          selected={statusFilter ?? "all"}
          onSelect={(id) => setStatusFilter(id === "all" ? null : id)}
        />
      </View>
    ) : null;
  const listHeader =
    paused || causes.length > 0 || statusPills ? (
      <>
        {paused ? <PausedBanner /> : null}
        <ActivityCauseCards
          causes={causes}
          // The tap, not the server's answer, so a second tap before the page
          // arrives clears it.
          selected={causeFilter}
          onSelect={setCauseFilter}
          inset={LIST_PADDING_HORIZONTAL}
        />
        {statusPills}
      </>
    ) : null;
  const showDiscoverAction = view === "history" && !statusFilter;

  return (
    <>
      <SettingsToolbar />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={FILTER_MENU_ICON}
          title="Filters"
          accessibilityLabel="Filter activity"
        >
          {menuOptionSection(
            "View",
            ACTIVITY_VIEWS.map((entry) => ({
              key: entry.id,
              label: counts?.[entry.id]
                ? `${entry.label} (${counts[entry.id]})`
                : entry.label,
            })),
            view,
            (id) => router.replace(`/${id}`),
          )}
        </Stack.Toolbar.Menu>
        {isQueue && (isAdmin || cancelable > 0) ? (
          <Stack.Toolbar.Menu
            icon={IS_IOS ? "ellipsis" : MoreVert}
            accessibilityLabel="Queue actions"
          >
            {isAdmin ? (
              <Stack.Toolbar.MenuAction
                icon={
                  IS_IOS
                    ? paused
                      ? "play.circle"
                      : "pause.circle"
                    : paused
                      ? PlayArrow
                      : PauseIcon
                }
                disabled={pauseQueue.isPending}
                onPress={() => pauseQueue.mutate(!paused)}
              >
                {paused ? "Resume Queue" : "Pause Queue"}
              </Stack.Toolbar.MenuAction>
            ) : null}
            {cancelable > 0 ? (
              <Stack.Toolbar.MenuAction
                icon={IS_IOS ? "xmark.circle" : CancelIcon}
                destructive
                // Until the chosen cause's page arrives, the count and scope
                // are the previous page's.
                disabled={cancelQueued.isPending || activity.isPlaceholderData}
                onPress={confirmCancel}
              >
                {`Cancel ${causeTitle ?? "All"} (${cancelable})…`}
              </Stack.Toolbar.MenuAction>
            ) : null}
          </Stack.Toolbar.Menu>
        ) : null}
      </Stack.Toolbar>
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          activity.isPending ? (
            <ActivityIndicator color={colors.brand} style={styles.loading} />
          ) : activity.isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              message="Failed to load activity"
              actionLabel="Try Again"
              onAction={() => void activity.refetch()}
            />
          ) : (
            <EmptyState
              icon="musical-notes-outline"
              message={
                statusFilter || appliedCause
                  ? "No matches"
                  : ACTIVITY_EMPTY_STATES[view].message
              }
              actionLabel={showDiscoverAction ? "Start Discovering" : undefined}
              onAction={
                showDiscoverAction
                  ? () => router.navigate("/(app)/(tabs)/(discover)")
                  : undefined
              }
            />
          )
        }
        onEndReached={activity.loadMore}
        onEndReachedThreshold={2}
        maintainVisibleContentPosition={NO_SCROLL_ANCHOR}
        ListFooterComponent={
          activity.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={styles.footer} />
          ) : null
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
        sheet={actionsSheet}
        request={sheetItem}
        downloadStatus={activeStatus}
      />
    </>
  );
}

function ItemSeparator() {
  return <View style={{ height: 8 }} />;
}

function PausedBanner() {
  const colors = useColors();
  return (
    <View
      style={[styles.paused, { backgroundColor: colors.surfaceMid }]}
      accessibilityRole="summary"
    >
      <Ionicons name="pause-circle" size={20} color={colors.warning} />
      <Text
        variant="caption"
        style={[styles.pausedText, { color: colors.text }]}
      >
        Downloads are paused. Tracks already downloading will finish.
      </Text>
    </View>
  );
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
  paused: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 12,
    borderRadius: Radius.compact,
  },
  pausedText: {
    flex: 1,
  },
  loading: {
    paddingVertical: 64,
  },
  footer: {
    paddingVertical: 16,
  },
});
