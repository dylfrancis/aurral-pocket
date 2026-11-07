import { useCallback, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, type ErrorBoundaryProps } from "expo-router";
import * as Burnt from "burnt";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { EmptyState } from "@/components/library/EmptyState";
import { PlaylistCard } from "@/components/flow/PlaylistCard";
import { PlaylistDetailSheet } from "@/components/flow/PlaylistDetailSheet";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { useFlowAudioPreview, useFlowStatusSuspense } from "@/hooks/flow";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import type { SharedPlaylist } from "@/lib/types/flow";

/**
 * The Library home hides this screen's row without `accessFlow`, but a deep
 * link still lands here. The fetch lives in the inner component because a
 * suspense query has no `enabled` option.
 */
export default function LibraryPlaylistsScreen() {
  const hasPermission = useHasPermission();

  if (!hasPermission("accessFlow")) {
    return (
      <ScreenCenter>
        <EmptyState
          icon="lock-closed-outline"
          message="You don't have access to Playlists"
        />
      </ScreenCenter>
    );
  }

  return <LibraryPlaylistsContent />;
}

function LibraryPlaylistsContent() {
  const colors = Colors[useColorScheme()];
  const { data, refetch } = useFlowStatusSuspense();
  const { stop } = useFlowAudioPreview();
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  // On this screen rather than the tab's layout: the screen is pushed, so going
  // back to the Library home must stop a preview too, and the layout's focus
  // only changes with the tab.
  useFocusEffect(
    useCallback(() => {
      return () => stop();
    }, [stop]),
  );

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      const result = await refetch();
      if (result.isError) {
        Burnt.toast({
          title: "Couldn't refresh playlists",
          preset: "error",
        });
      }
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  const sheetRef = useRef<BottomSheetModal>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openPlaylist = useCallback(
    (playlistId: string) => {
      if (deletingId === playlistId) return;
      setActiveId(playlistId);
      sheetRef.current?.present();
    },
    [deletingId],
  );

  const { sharedPlaylistStats, retryCyclePausedByPlaylist } = data;
  const renderItem = useCallback(
    ({ item: playlist }: { item: SharedPlaylist }) => (
      <View style={styles.cardWrap}>
        <PlaylistCard
          playlist={playlist}
          stats={sharedPlaylistStats?.[playlist.id]}
          retryPaused={!!retryCyclePausedByPlaylist?.[playlist.id]}
          isDeleting={deletingId === playlist.id}
          onPress={() => openPlaylist(playlist.id)}
        />
      </View>
    ),
    [sharedPlaylistStats, retryCyclePausedByPlaylist, deletingId, openPlaylist],
  );

  return (
    <>
      <FlashList
        data={data.sharedPlaylists}
        renderItem={renderItem}
        keyExtractor={(playlist) => playlist.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="list-outline"
              message="No playlists yet. Add a track from an album or flow to start one."
            />
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handlePullRefresh}
            tintColor={colors.brand}
          />
        }
      />
      <PlaylistDetailSheet
        sheetRef={sheetRef}
        playlistId={activeId}
        onClose={() => setActiveId(null)}
        onDeleting={setDeletingId}
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
