import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import FilterList from "@expo/material-symbols/filter_list.xml";
import { EmptyState } from "@/components/library/EmptyState";
import { FlowAccessGate } from "@/components/flow/FlowAccessGate";
import { PlaylistCard } from "@/components/flow/PlaylistCard";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { showMenuSection } from "@/components/ui/ShowMenuSection";
import { useFlowStatusSuspense } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { IS_IOS } from "@/constants/platform";
import { Colors } from "@/constants/theme";
import { useSavedIds } from "@/lib/offline/saved-library";
import type { SharedPlaylist } from "@/lib/types/flow";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

export default function LibraryPlaylistsScreen() {
  return (
    <FlowAccessGate message="You don't have access to Playlists">
      <LibraryPlaylistsContent />
    </FlowAccessGate>
  );
}

type Show = "all" | "saved";

function LibraryPlaylistsContent() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const { data, refetch } = useFlowStatusSuspense();
  const [show, setShow] = useState<Show>("all");
  const savedIds = useSavedIds("playlist");
  const showSaved = show === "saved";
  const playlists = showSaved
    ? data.sharedPlaylists.filter((playlist) => savedIds.has(playlist.id))
    : data.sharedPlaylists;

  const toolbar = useMemo(
    () => (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={IS_IOS ? "line.3.horizontal.decrease" : FilterList}
          title="Filters"
          accessibilityLabel="Filter playlists"
        >
          {showMenuSection<Show>(
            [
              { key: "all", label: "All Playlists" },
              { key: "saved", label: "Saved Offline" },
            ],
            show,
            setShow,
          )}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    ),
    [show],
  );

  const { refreshing, onRefresh } = usePullToRefresh(
    refetch,
    "Couldn't refresh playlists",
  );

  const { sharedPlaylistStats, retryCyclePausedByPlaylist } = data;
  const renderItem = useCallback(
    ({ item: playlist }: { item: SharedPlaylist }) => (
      <View style={styles.cardWrap}>
        <PlaylistCard
          playlist={playlist}
          stats={sharedPlaylistStats?.[playlist.id]}
          retryPaused={!!retryCyclePausedByPlaylist?.[playlist.id]}
          onPress={() =>
            router.push({
              pathname: "/playlist/[id]",
              params: { id: playlist.id },
            })
          }
        />
      </View>
    ),
    [sharedPlaylistStats, retryCyclePausedByPlaylist, router],
  );

  return (
    <>
      {toolbar}
      <FlashList
        data={playlists}
        renderItem={renderItem}
        keyExtractor={(playlist) => playlist.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {showSaved ? (
              <EmptyState
                icon="arrow-down-circle-outline"
                message="No playlists saved offline"
              />
            ) : (
              <EmptyState
                icon="list-outline"
                message="No playlists yet. Add a track from an album or flow to start one."
              />
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
      />
    </>
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load playlists" />;
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  cardWrap: {
    paddingBottom: 12,
  },
  emptyWrap: {
    paddingTop: 60,
  },
});
