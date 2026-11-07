import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter, type ErrorBoundaryProps } from "expo-router";
import * as Burnt from "burnt";
import { EmptyState } from "@/components/library/EmptyState";
import { FlowAccessGate } from "@/components/flow/FlowAccessGate";
import { PlaylistCard } from "@/components/flow/PlaylistCard";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { useFlowStatusSuspense } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import type { SharedPlaylist } from "@/lib/types/flow";

export default function LibraryPlaylistsScreen() {
  return (
    <FlowAccessGate message="You don't have access to Playlists">
      <LibraryPlaylistsContent />
    </FlowAccessGate>
  );
}

function LibraryPlaylistsContent() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const { data, refetch } = useFlowStatusSuspense();
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

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
