import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  useBottomSheetScrollableCreator,
} from "@gorhom/bottom-sheet";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { TrackRow } from "./TrackRow";
import { MixPills } from "./MixPills";
import { ProgressBar } from "./ProgressBar";
import {
  useConvertFlowToStaticPlaylist,
  useDeleteFlow,
  useFlow,
  useFlowAudioPreview,
  useFlowStats,
  useJobsForPlaylist,
  useRetryCyclePaused,
  useSetFlowEnabled,
  useSetRetryCyclePaused,
  useStartFlow,
  useFlowStatus,
} from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { FlowJob } from "@/lib/types/flow";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  flowId: string | null;
  onClose: () => void;
};

export function FlowDetailSheet({ sheetRef, flowId, onClose }: Props) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flow = useFlow(flowId ?? undefined);
  const stats = useFlowStats(flowId ?? undefined);
  const jobs = useJobsForPlaylist(flowId ?? undefined);
  const retryPaused = useRetryCyclePaused(flowId ?? undefined);
  const { data: status } = useFlowStatus();
  const { stop } = useFlowAudioPreview();

  const setEnabled = useSetFlowEnabled();
  const startFlow = useStartFlow();
  const deleteFlow = useDeleteFlow();
  const convertFlow = useConvertFlowToStaticPlaylist();
  const setRetryPaused = useSetRetryCyclePaused();

  const renderScrollComponent = useBottomSheetScrollableCreator();

  const dismiss = useCallback(() => {
    sheetRef.current?.dismiss();
  }, [sheetRef]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const handleEdit = () => {
    if (!flow) return;
    dismiss();
    router.push({
      pathname: "/(app)/(tabs)/(flow)/flow-edit",
      params: { id: flow.id },
    });
  };

  const handleStartNow = () => {
    if (!flow) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startFlow.mutate({ flowId: flow.id });
  };

  const handleConvert = () => {
    if (!flow) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Convert to Static Playlist",
      `Save the current "${flow.name}" tracks as a static playlist?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: () =>
            convertFlow.mutate({
              flowId: flow.id,
              name: `${flow.name} Static`,
            }),
        },
      ],
    );
  };

  const handleToggleRetryPaused = () => {
    if (!flow) return;
    setRetryPaused.mutate({ playlistId: flow.id, paused: !retryPaused });
  };

  const handleDelete = () => {
    if (!flow) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Flow",
      `Remove "${flow.name}"? Its files will be cleaned up.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteFlow.mutate(flow.id, {
              onSuccess: () => {
                stop();
                dismiss();
              },
            });
          },
        },
      ],
    );
  };

  const headerHint = useMemo(() => {
    if (!flow) return null;
    if (status?.hint) return status.hint.message;
    if (!flow.enabled) return "Disabled";
    return null;
  }, [flow, status?.hint]);

  const scheduleText = useMemo(() => {
    if (!flow) return "";
    if (!flow.scheduleDays?.length) return "Manual";
    return `${flow.scheduleDays.map((d) => DAY_LABELS[d]).join(", ")} · ${flow.scheduleTime}`;
  }, [flow]);

  const renderItem = useCallback(
    ({ item }: { item: FlowJob }) => <TrackRow job={item} />,
    [],
  );

  const renderHeader = () => {
    if (!flow) return null;
    return (
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <Text
              variant="title"
              numberOfLines={1}
              style={[styles.title, { color: colors.text }]}
            >
              {flow.name}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {flow.size} tracks · {scheduleText}
            </Text>
          </View>
          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.brandMuted,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            accessibilityLabel="Edit flow"
          >
            <Ionicons name="pencil" size={18} color={colors.brandStrong} />
          </Pressable>
        </View>

        <View style={styles.mixWrap}>
          <ProgressBar done={stats?.done ?? 0} total={flow.size} />
          <View style={styles.mixPillsWrap}>
            <MixPills mix={flow.mix} />
          </View>
        </View>

        {headerHint ? (
          <View
            style={[
              styles.hintRow,
              {
                backgroundColor: colors.brandMuted,
                borderColor: colors.separator,
              },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.brandStrong}
            />
            <Text
              variant="caption"
              style={{ color: colors.brandStrong, fontFamily: Fonts.medium }}
            >
              {headerHint}
            </Text>
          </View>
        ) : null}

        <View style={[styles.enableRow, { borderColor: colors.separator }]}>
          <View style={{ flex: 1 }}>
            <Text variant="body" style={{ fontFamily: Fonts.medium }}>
              Enabled
            </Text>
            <Text variant="caption">Refresh on schedule when on.</Text>
          </View>
          <Switch
            value={flow.enabled}
            onValueChange={(next) =>
              setEnabled.mutate({ flowId: flow.id, enabled: next })
            }
            trackColor={{ false: colors.separator, true: colors.brand }}
            thumbColor={colors.surfaceElevated}
            ios_backgroundColor={colors.separator}
          />
        </View>

        <View style={[styles.actions, { borderColor: colors.separator }]}>
          <ActionRow
            icon="play-circle-outline"
            label="Start Now"
            color={colors.brand}
            loading={startFlow.isPending}
            onPress={handleStartNow}
          />
          <ActionRow
            icon="bookmark-outline"
            label="Convert to Static"
            color={colors.text}
            loading={convertFlow.isPending}
            disabled={(stats?.done ?? 0) === 0}
            onPress={handleConvert}
          />
          <ActionRow
            icon={retryPaused ? "play-outline" : "pause-outline"}
            label={retryPaused ? "Resume Retry" : "Pause Retry"}
            color={colors.text}
            loading={setRetryPaused.isPending}
            onPress={handleToggleRetryPaused}
          />
          <ActionRow
            icon="trash-outline"
            label="Delete Flow"
            color={colors.error}
            loading={deleteFlow.isPending}
            onPress={handleDelete}
          />
        </View>

        <Text
          variant="subtitle"
          style={[
            styles.tracksHeader,
            { color: colors.text, fontFamily: Fonts.semiBold },
          ]}
        >
          Tracks
        </Text>
      </View>
    );
  };

  const renderEmpty = useCallback(
    () => (
      <View style={styles.empty}>
        <Text variant="caption">
          {flow?.enabled
            ? "Tracks will appear once the flow runs."
            : "Enable the flow or tap Start Now to populate tracks."}
        </Text>
      </View>
    ),
    [flow?.enabled],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["90%"]}
      enablePanDownToClose
      enableDynamicSizing={false}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      {flow ? (
        <FlashList
          data={jobs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          renderScrollComponent={renderScrollComponent}
        />
      ) : null}
    </BottomSheetModal>
  );
}

function ActionRow({
  icon,
  label,
  color,
  loading,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.actionRow,
        { opacity: pressed && !disabled ? 0.6 : disabled ? 0.4 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size={18} color={color} />
      ) : (
        <Ionicons name={icon} size={18} color={color} />
      )}
      <Text variant="body" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: Fonts.bold,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mixWrap: {
    paddingHorizontal: 16,
    gap: 10,
  },
  mixPillsWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  hintRow: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  enableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  actions: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  tracksHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
});
