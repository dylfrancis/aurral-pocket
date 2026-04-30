import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { Text } from "@/components/ui/Text";
import { EmptyState } from "@/components/library/EmptyState";
import { FlowCard } from "@/components/flow/FlowCard";
import { PlaylistCard } from "@/components/flow/PlaylistCard";
import { FlowDetailSheet } from "@/components/flow/FlowDetailSheet";
import { PlaylistDetailSheet } from "@/components/flow/PlaylistDetailSheet";
import { useFlowStatus, useSetFlowEnabled } from "@/hooks/flow";
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
  const { data, isLoading, error, refetch } = useFlowStatus();
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const setEnabled = useSetFlowEnabled();

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  const flowSheetRef = useRef<BottomSheetModal>(null);
  const playlistSheetRef = useRef<BottomSheetModal>(null);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  const rows = useMemo<SectionRow[]>(() => {
    if (!data) return [];
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

  const openFlow = useCallback((flowId: string) => {
    setActiveFlowId(flowId);
    flowSheetRef.current?.present();
  }, []);

  const openPlaylist = useCallback((playlistId: string) => {
    setActivePlaylistId(playlistId);
    playlistSheetRef.current?.present();
  }, []);

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
            onPress={() => openPlaylist(item.playlist.id)}
          />
        </View>
      );
    },
    [colors.text, openFlow, openPlaylist, setEnabled],
  );

  if (isLoading && !data) {
    return <ScreenCenter loading />;
  }

  if (error && !data) {
    return (
      <ScreenCenter>
        <EmptyState
          icon="cloud-offline-outline"
          message="Failed to load flows"
          actionLabel="Try Again"
          onAction={() => refetch()}
        />
      </ScreenCenter>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() =>
                  router.push("/(app)/(tabs)/(flow)/worker-settings")
                }
                style={({ pressed }) => [
                  styles.headerButton,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                accessibilityLabel="Worker settings"
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={colors.text}
                />
              </Pressable>
              <Pressable
                onPress={() => router.push("/(app)/(tabs)/(flow)/flow-edit")}
                style={({ pressed }) => [
                  styles.headerButton,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                accessibilityLabel="Create flow"
              >
                <Ionicons name="add" size={26} color={colors.text} />
              </Pressable>
            </View>
          ),
        }}
      />
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
              onAction={() => router.push("/(app)/(tabs)/(flow)/flow-edit")}
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
      />
      <PlaylistDetailSheet
        sheetRef={playlistSheetRef}
        playlistId={activePlaylistId}
        onClose={() => setActivePlaylistId(null)}
      />
    </>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});
