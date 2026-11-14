import { useCallback } from "react";
import { Alert, RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import Settings from "@expo/material-symbols/settings.xml";
import Add from "@expo/material-symbols/add.xml";
import Tune from "@expo/material-symbols/tune.xml";
import GraphicEq from "@expo/material-symbols/graphic_eq.xml";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { EmptyState } from "@/components/library/EmptyState";
import { FlowCard } from "@/components/flow/FlowCard";
import { FlowAccessGate } from "@/components/flow/FlowAccessGate";
import {
  useCreateFlowFromTemplate,
  useFlowStatusSuspense,
  useFlowTemplates,
  useSetFlowEnabled,
} from "@/hooks/flow";
import { IS_ANDROID, IS_IOS } from "@/constants/platform";
import { OverflowMenu } from "@/components/navigation/OverflowMenu";
import type { Flow } from "@/lib/types/flow";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useColors } from "@/hooks/use-colors";

/**
 * NativeTabs mounts every tab's screen at launch — `hidden` on a Trigger only
 * blanks the tab bar item, it does not stop the screen from rendering. Without
 * this guard, a user without `accessFlow` still fetches `/playlists/status` on
 * cold launch and takes a 403 for a tab they cannot even see.
 */
export default function FlowScreen() {
  return (
    <FlowAccessGate message="You don't have access to Flows">
      <FlowScreenContent />
    </FlowAccessGate>
  );
}

function FlowScreenContent() {
  const colors = useColors();
  const router = useRouter();
  const { data, refetch } = useFlowStatusSuspense();
  const setEnabled = useSetFlowEnabled();

  const { refreshing, onRefresh } = usePullToRefresh(
    refetch,
    "Couldn't refresh flows",
  );

  const flowStats = data.flowStats;
  const renderItem = useCallback(
    ({ item: flow }: { item: Flow }) => (
      <View style={styles.cardWrap}>
        <FlowCard
          flow={flow}
          stats={flowStats?.[flow.id]}
          onPress={() =>
            router.push({ pathname: "/flow/[id]", params: { id: flow.id } })
          }
          onToggleEnabled={(next) =>
            setEnabled.mutate({ flowId: flow.id, enabled: next })
          }
        />
      </View>
    ),
    [flowStats, router, setEnabled],
  );

  const openWorkerSettings = useCallback(
    () => router.push("/(app)/(tabs)/(flow)/worker-settings"),
    [router],
  );
  const openCreateFlow = useCallback(
    () => router.push("/(app)/(tabs)/(flow)/flow-edit"),
    [router],
  );

  const { data: templates } = useFlowTemplates();
  const createFromTemplate = useCreateFlowFromTemplate();
  const pickTemplate = (templateId: string) =>
    createFromTemplate.mutate(templateId, {
      onSuccess: (flow) =>
        router.push({ pathname: "/flow/[id]", params: { id: flow.id } }),
      onError: (err) => Alert.alert("Could not create", err.message),
    });

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
        <Stack.Toolbar.Menu
          icon={IS_IOS ? "plus" : Add}
          accessibilityLabel="Create flow"
          disabled={createFromTemplate.isPending}
        >
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "slider.horizontal.3" : Tune}
            onPress={openCreateFlow}
          >
            Custom Flow
          </Stack.Toolbar.MenuAction>
          {templates?.length ? (
            <Stack.Toolbar.Menu inline title="Start from a template">
              {templates.map((template) => (
                <Stack.Toolbar.MenuAction
                  key={template.id}
                  icon={IS_IOS ? "waveform" : GraphicEq}
                  disabled={!template.available}
                  onPress={() => pickTemplate(template.id)}
                >
                  {template.name}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
          ) : null}
        </Stack.Toolbar.Menu>
        {IS_ANDROID && <OverflowMenu />}
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
