import { useCallback, useMemo } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import PlayArrow from "@expo/material-symbols/play_arrow.xml";
import Bookmark from "@expo/material-symbols/bookmark.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";

import { EmptyState } from "@/components/library/EmptyState";
import { CircleButton } from "@/components/ui/CircleButton";
import { PLAY_ROW_HEIGHT, PlayRow } from "@/components/ui/PlayRow";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { Text } from "@/components/ui/Text";
import { AddToPlaylistSheet, useAddToPlaylist } from "./AddToPlaylistSheet";
import { CollectionArtwork } from "./CollectionArtwork";
import {
  COVER_SIZE,
  CollectionHero,
  CollectionPage,
  summaryLine,
} from "./CollectionPage";
import { FlowAccessGate } from "./FlowAccessGate";
import { MixPills } from "./MixPills";
import { ProgressBar } from "./ProgressBar";
import {
  useConvertFlowToStaticPlaylist,
  useDeleteFlow,
  useFlowStatusSuspense,
  usePlaylistJobs,
  useStartFlow,
  useTrackJobMenu,
} from "@/hooks/flow";
import { usePlaylistPlayback } from "@/hooks/flow/use-playlist-playback";
import type {
  TrackMenuAction,
  TrackMenuActionId,
} from "@/components/player/track-menu-types";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import { scheduleLabel } from "@/lib/flow-schedule";
import { flowKeys } from "@/lib/query-keys";
import type {
  Flow,
  FlowJob,
  FlowStatusSnapshot,
  PlaylistStats,
  SharedPlaylist,
  StatusHintPhase,
} from "@/lib/types/flow";

const NO_JOBS: FlowJob[] = [];

const BUSY_PHASES: StatusHintPhase[] = ["preparing", "downloading", "queued"];

/**
 * Numbered the way the web does. Otherwise a second conversion of the same flow
 * fails on the name.
 */
function nextStaticPlaylistName(flowName: string, playlists: SharedPlaylist[]) {
  const toKey = (name: string) => name.trim().toLowerCase();
  const taken = new Set(playlists.map((playlist) => toKey(playlist.name)));
  const base = `${flowName} Static`;
  let name = base;
  for (let n = 2; taken.has(toKey(name)); n += 1) name = `${base} ${n}`;
  return name;
}

export function FlowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <FlowAccessGate message="You don't have access to Flows">
      <FlowLookup id={id} />
    </FlowAccessGate>
  );
}

function FlowLookup({ id }: { id: string }) {
  const { data } = useFlowStatusSuspense();
  const flow = data.flows.find((entry) => entry.id === id);

  if (!flow) {
    return (
      <ScreenCenter>
        <EmptyState
          icon="alert-circle-outline"
          message="This flow no longer exists"
        />
      </ScreenCenter>
    );
  }

  return (
    <FlowPage
      flow={flow}
      stats={data.flowStats?.[id]}
      // Worker-wide, not this flow's. At rest it reads "Idle" or names another
      // flow's next run, so it's only worth a line while the worker is busy.
      workerHint={
        data.hint && BUSY_PHASES.includes(data.hint.phase)
          ? data.hint.message
          : undefined
      }
    />
  );
}

function FlowPage({
  flow,
  stats,
  workerHint,
}: {
  flow: Flow;
  stats?: PlaylistStats;
  workerHint?: string;
}) {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const queryClient = useQueryClient();

  // Failed and cancelled tracks stay listed, so they can be retried before the
  // next run replaces them.
  const { data: jobs = NO_JOBS, isLoading: jobsLoading } = usePlaylistJobs(
    flow.id,
  );
  const collection = useMemo(
    () => ({ ...flow, kind: "flow" as const }),
    [flow],
  );
  const { canPlay, playFrom, playAll, shuffle } = usePlaylistPlayback(
    collection,
    jobs,
  );

  const startFlow = useStartFlow();
  const deleteFlow = useDeleteFlow();
  const convertFlow = useConvertFlowToStaticPlaylist();
  const addToPlaylist = useAddToPlaylist();

  const startMutate = startFlow.mutate;
  const handleStartNow = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startMutate({ flowId: flow.id });
  }, [flow.id, startMutate]);

  const convertMutate = convertFlow.mutate;
  const handleConvert = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Convert to Static Playlist",
      `Save the current "${flow.name}" tracks as a static playlist?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          // Read at the press: depending on the list would rebuild the toolbar
          // whenever any playlist changes.
          onPress: () =>
            convertMutate({
              flowId: flow.id,
              name: nextStaticPlaylistName(
                flow.name,
                queryClient.getQueryData<FlowStatusSnapshot>(flowKeys.status())
                  ?.sharedPlaylists ?? [],
              ),
            }),
        },
      ],
    );
  }, [flow.id, flow.name, queryClient, convertMutate]);

  const deleteMutate = deleteFlow.mutate;
  const handleDelete = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Flow",
      `Remove "${flow.name}"? Its files will be cleaned up.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          // Leaves first: the refetch a delete triggers can drop the flow from
          // the snapshot and unmount this page, and a callback here would never
          // run. A failure still reports itself from the hook.
          onPress: () => {
            router.back();
            deleteMutate(flow.id);
          },
        },
      ],
    );
  }, [flow.id, flow.name, router, deleteMutate]);

  // A flow's tracks are regenerated on every run; saving one into a static
  // playlist is how it survives the next refresh.
  const openAddToPlaylist = addToPlaylist.open;
  const { actionsFor: jobActionsFor, runAction: runJobAction } =
    useTrackJobMenu();
  const trackMenuActions = useCallback(
    (job: FlowJob): TrackMenuAction[] =>
      job.status === "done"
        ? [{ id: "playlist", title: "Add to Playlist" }]
        : jobActionsFor(job),
    [jobActionsFor],
  );
  const handleTrackMenuAction = useCallback(
    (job: FlowJob, id: TrackMenuActionId) => {
      if (runJobAction(job, id) || id !== "playlist") return;
      openAddToPlaylist({
        artistName: job.artistName,
        trackName: job.trackName,
        albumName: job.albumName ?? null,
        artistMbid: job.artistMbid ?? null,
        reason: job.reason ?? null,
      });
    },
    [runJobAction, openAddToPlaylist],
  );

  const isStartPending = startFlow.isPending;
  const isConvertPending = convertFlow.isPending;
  const hasReadyTracks = (stats?.done ?? 0) > 0;
  const toolbar = useMemo(
    () => (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={IS_IOS ? "ellipsis" : MoreVert}
          accessibilityLabel="More actions"
        >
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "play.circle" : PlayArrow}
            disabled={isStartPending}
            onPress={handleStartNow}
          >
            Start Now
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "bookmark" : Bookmark}
            disabled={isConvertPending || !hasReadyTracks}
            onPress={handleConvert}
          >
            Convert to Static
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "trash" : DeleteIcon}
            destructive
            onPress={handleDelete}
          >
            Delete Flow
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    ),
    [
      isStartPending,
      isConvertPending,
      hasReadyTracks,
      handleStartNow,
      handleConvert,
      handleDelete,
    ],
  );

  return (
    <>
      <CollectionPage
        title={flow.name}
        jobs={jobs}
        jobsLoading={jobsLoading}
        searchPlaceholder="Search this flow"
        toolbar={toolbar}
        emptyMessage={
          flow.enabled
            ? "Tracks will appear once the flow runs."
            : "Turn the flow on in the Flows list, or choose Start Now from the menu, to get tracks."
        }
        onPlayTrack={playFrom}
        trackMenuActions={trackMenuActions}
        onTrackMenuAction={handleTrackMenuAction}
        header={
          <>
            <CollectionHero
              name={flow.name}
              artwork={
                <CollectionArtwork
                  collection={flow}
                  kind="flow"
                  stats={stats}
                  size={COVER_SIZE}
                  radius={12}
                />
              }
            >
              <Text variant="body" style={{ color: colors.subtle }}>
                {scheduleLabel(flow)}
              </Text>
              <Text variant="caption" style={{ color: colors.subtle }}>
                {summaryLine(flow.size, stats)}
              </Text>
              <View style={styles.progress}>
                <ProgressBar done={stats?.done ?? 0} total={flow.size} />
              </View>
              <MixPills mix={flow.mix} />
              {workerHint ? (
                <View style={styles.hint}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={colors.subtle}
                  />
                  <Text variant="caption" style={{ color: colors.subtle }}>
                    {workerHint}
                  </Text>
                </View>
              ) : null}
            </CollectionHero>
            <PlayRow
              title={flow.name}
              disabled={!canPlay}
              onPlay={() => void playAll()}
              onShuffle={() => void shuffle()}
            >
              <CircleButton
                icon="pencil"
                size={PLAY_ROW_HEIGHT}
                accessibilityLabel={`Edit ${flow.name}`}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(tabs)/(flow)/flow-edit",
                    params: { id: flow.id },
                  })
                }
              />
            </PlayRow>
          </>
        }
      />
      <AddToPlaylistSheet
        track={addToPlaylist.track}
        onClose={addToPlaylist.close}
      />
    </>
  );
}

const styles = StyleSheet.create({
  progress: {
    alignSelf: "stretch",
    marginTop: 4,
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
