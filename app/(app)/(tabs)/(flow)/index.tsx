import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Settings from "@expo/material-symbols/settings.xml";
import Add from "@expo/material-symbols/add.xml";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { Text } from "@/components/ui/Text";
import { EmptyState } from "@/components/library/EmptyState";
import { FlowCard } from "@/components/flow/FlowCard";
import { PlaylistCard } from "@/components/flow/PlaylistCard";
import { FlowDetailSheet } from "@/components/flow/FlowDetailSheet";
import { PlaylistDetailSheet } from "@/components/flow/PlaylistDetailSheet";
import { useFlowStatusSuspense, useSetFlowEnabled } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { Flow, PlaylistStats, SharedPlaylist } from "@/lib/types/flow";

type SectionRow =
  | { kind: "header"; title: string; key: string }
  | { kind: "flow"; flow: Flow; stats?: PlaylistStats; key: string }
  | {
      kind: "playlist";
      playlist: SharedPlaylist;
      stats?: PlaylistStats;
      retryPaused?: boolean;
      key: string;
    };

export default function FlowScreen() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const { data, refetch } = useFlowStatusSuspense();
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const setEnabled = useSetFlowEnabled();

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      const result = await refetch();
      if (result.isError) {
        Burnt.toast({
          title: "Couldn't refresh flows",
          preset: "error",
        });
      }
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  const flowSheetRef = useRef<BottomSheetModal>(null);
  const playlistSheetRef = useRef<BottomSheetModal>(null);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(
    null,
  );

  const rows = useMemo<SectionRow[]>(() => {
    const out: SectionRow[] = [];
    if (data.flows.length > 0) {
      for (const flow of data.flows) {
        out.push({
          kind: "flow",
          flow,
          stats: data.flowStats?.[flow.id],
          key: `flow-${flow.id}`,
        });
      }
    }
    if (data.sharedPlaylists.length > 0) {
      out.push({ kind: "header", title: "Playlists", key: "h-playlists" });
      for (const playlist of data.sharedPlaylists) {
        out.push({
          kind: "playlist",
          playlist,
          stats: data.sharedPlaylistStats?.[playlist.id],
          retryPaused: !!data.retryCyclePausedByPlaylist?.[playlist.id],
          key: `pl-${playlist.id}`,
        });
      }
    }
    return out;
  }, [data]);

  const openFlow = useCallback(
    (flowId: string) => {
      if (deletingFlowId === flowId) return;
      setActiveFlowId(flowId);
      flowSheetRef.current?.present();
    },
    [deletingFlowId],
  );

  const openPlaylist = useCallback(
    (playlistId: string) => {
      if (deletingPlaylistId === playlistId) return;
      setActivePlaylistId(playlistId);
      playlistSheetRef.current?.present();
    },
    [deletingPlaylistId],
  );

  const renderItem = useCallback(
    ({ item }: { item: SectionRow }) => {
      if (item.kind === "header") {
        return (
          <Text
            variant="subtitle"
            style={[
              styles.sectionHeader,
              { color: colors.text, fontFamily: Fonts.semiBold },
            ]}
          >
            {item.title}
          </Text>
        );
      }
      if (item.kind === "flow") {
        return (
          <View style={styles.cardWrap}>
            <FlowCard
              flow={item.flow}
              stats={item.stats}
              isDeleting={deletingFlowId === item.flow.id}
              onPress={() => openFlow(item.flow.id)}
              onToggleEnabled={(next) =>
                setEnabled.mutate({ flowId: item.flow.id, enabled: next })
              }
            />
          </View>
        );
      }
      return (
        <View style={styles.cardWrap}>
          <PlaylistCard
            playlist={item.playlist}
            stats={item.stats}
            retryPaused={item.retryPaused}
            isDeleting={deletingPlaylistId === item.playlist.id}
            onPress={() => openPlaylist(item.playlist.id)}
          />
        </View>
      );
    },
    [
      colors.text,
      openFlow,
      openPlaylist,
      setEnabled,
      deletingFlowId,
      deletingPlaylistId,
    ],
  );

  const openWorkerSettings = useCallback(
    () => router.push("/(app)/(tabs)/(flow)/worker-settings"),
    [router],
  );
  const openCreateFlow = useCallback(
    () => router.push("/(app)/(tabs)/(flow)/flow-edit"),
    [router],
  );

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={process.env.EXPO_OS === "ios" ? "gearshape" : Settings}
          accessibilityLabel="Worker settings"
          onPress={openWorkerSettings}
        >
          Worker settings
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          icon={process.env.EXPO_OS === "ios" ? "plus" : Add}
          accessibilityLabel="Create flow"
          onPress={openCreateFlow}
        >
          Create flow
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.kind}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="albums-outline"
              message="No flows or playlists yet"
              actionLabel="Create Flow"
              onAction={() => {
                router.push("/(app)/(tabs)/(flow)/flow-edit");
              }}
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
      <FlowDetailSheet
        sheetRef={flowSheetRef}
        flowId={activeFlowId}
        onClose={() => setActiveFlowId(null)}
        onDeleting={setDeletingFlowId}
      />
      <PlaylistDetailSheet
        sheetRef={playlistSheetRef}
        playlistId={activePlaylistId}
        onClose={() => setActivePlaylistId(null)}
        onDeleting={setDeletingPlaylistId}
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
        message="Failed to load flows"
        actionLabel="Try Again"
        onAction={() => {
          reset();
          retry();
        }}
      />
    </ScreenCenter>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  cardWrap: {
    paddingBottom: 12,
  },
  emptyWrap: {
    paddingTop: 60,
  },
});
