import { useCallback, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import * as Burnt from "burnt";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Settings from "@expo/material-symbols/settings.xml";
import Add from "@expo/material-symbols/add.xml";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { EmptyState } from "@/components/library/EmptyState";
import { FlowCard } from "@/components/flow/FlowCard";
import { FlowDetailSheet } from "@/components/flow/FlowDetailSheet";
import { useFlowStatusSuspense, useSetFlowEnabled } from "@/hooks/flow";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import type { Flow } from "@/lib/types/flow";

/**
 * NativeTabs mounts every tab's screen at launch — `hidden` on a Trigger only
 * blanks the tab bar item, it does not stop the screen from rendering. Without
 * this guard, a user without `accessFlow` still fetches `/playlists/status` on
 * cold launch and takes a 403 for a tab they cannot even see.
 *
 * The fetch lives in the inner component because a suspense query has no
 * `enabled` option; the only way not to fire it is not to render the hook.
 */
export default function FlowScreen() {
  const hasPermission = useHasPermission();

  if (!hasPermission("accessFlow")) {
    return (
      <ScreenCenter>
        <EmptyState
          icon="lock-closed-outline"
          message="You don't have access to Flows"
        />
      </ScreenCenter>
    );
  }

  return <FlowScreenContent />;
}

function FlowScreenContent() {
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
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);

  const openFlow = useCallback(
    (flowId: string) => {
      if (deletingFlowId === flowId) return;
      setActiveFlowId(flowId);
      flowSheetRef.current?.present();
    },
    [deletingFlowId],
  );

  const flowStats = data.flowStats;
  const renderItem = useCallback(
    ({ item: flow }: { item: Flow }) => (
      <View style={styles.cardWrap}>
        <FlowCard
          flow={flow}
          stats={flowStats?.[flow.id]}
          isDeleting={deletingFlowId === flow.id}
          onPress={() => openFlow(flow.id)}
          onToggleEnabled={(next) =>
            setEnabled.mutate({ flowId: flow.id, enabled: next })
          }
        />
      </View>
    ),
    [flowStats, openFlow, setEnabled, deletingFlowId],
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
          icon={IS_IOS ? "gearshape" : Settings}
          accessibilityLabel="Worker settings"
          onPress={openWorkerSettings}
        >
          Worker settings
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          icon={IS_IOS ? "plus" : Add}
          accessibilityLabel="Create flow"
          onPress={openCreateFlow}
        >
          Create flow
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <FlashList
        data={data.flows}
        renderItem={renderItem}
        keyExtractor={(flow) => flow.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="albums-outline"
              message="No flows yet"
              actionLabel="Create Flow"
              onAction={openCreateFlow}
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
    </>
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load flows" />;
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
