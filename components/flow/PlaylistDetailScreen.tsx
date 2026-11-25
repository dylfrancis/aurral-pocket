import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import ArrowCircleDown from "@expo/material-symbols/arrow_circle_down.xml";
import Sync from "@expo/material-symbols/sync.xml";
import Refresh from "@expo/material-symbols/refresh.xml";
import FileDownloadOff from "@expo/material-symbols/file_download_off.xml";

import { EmptyState } from "@/components/library/EmptyState";
import { pluginMenuSection } from "@/components/plugins/PluginMenuActions";
import { CircleButton } from "@/components/ui/CircleButton";
import { PLAY_ROW_HEIGHT, PlayRow } from "@/components/ui/PlayRow";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { Text } from "@/components/ui/Text";
import { CollectionArtwork } from "./CollectionArtwork";
import { CollectionHero, CollectionPage, summaryLine } from "./CollectionPage";
import { FlowAccessGate } from "./FlowAccessGate";
import {
  useDeleteSharedPlaylist,
  useDeleteSharedPlaylistTrack,
  useFlowStatusSuspense,
  usePlaylistJobs,
  useTrackJobMenu,
} from "@/hooks/flow";
import { usePlaylistPlayback } from "@/hooks/flow/use-playlist-playback";
import { useSaveOffline } from "@/hooks/offline/use-save-offline";
import { cachedAlbumCover } from "@/hooks/player/queue-covers";
import { usePluginActions } from "@/hooks/plugins/use-plugin-actions";
import {
  collectionPlayerContext,
  jobToPlayerTrack,
} from "@/lib/player/track-item";
import { saveStatusLine } from "@/lib/offline/format";
import { useIsOffline } from "@/lib/offline/network";
import {
  savePlaylist,
  setKeepUpdated,
  useSavedStatus,
} from "@/lib/offline/saved-library";
import {
  TrackActionsSheet,
  useTrackActions,
} from "@/components/library/TrackActionsSheet";
import type { TrackMenuActionId } from "@/components/player/track-menu-types";
import { IS_IOS } from "@/constants/platform";
import { checkableMenuItem } from "@/components/ui/MenuOptions";
import type { FlowJob, PlaylistStats, SharedPlaylist } from "@/lib/types/flow";
import { useColors } from "@/hooks/use-colors";
import { useHeroCoverSize } from "@/hooks/use-hero-cover-size";

const NO_JOBS: FlowJob[] = [];

export function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isOffline = useIsOffline();
  const saved = useSavedStatus("playlist", id)?.item;

  return (
    <FlowAccessGate message="You don't have access to Playlists">
      {/* The lookup suspends on the server, which can't answer offline. A
          saved playlist opens from what the phone kept. */}
      {isOffline && saved?.kind === "playlist" ? (
        <PlaylistPage playlist={saved.playlist} />
      ) : (
        <PlaylistLookup id={id} />
      )}
    </FlowAccessGate>
  );
}

function PlaylistLookup({ id }: { id: string }) {
  const { data } = useFlowStatusSuspense();
  const playlist = data.staticPlaylists.find((entry) => entry.id === id);

  if (!playlist) {
    return (
      <ScreenCenter>
        <EmptyState
          icon="alert-circle-outline"
          message="This playlist no longer exists"
        />
      </ScreenCenter>
    );
  }

  return (
    <PlaylistPage playlist={playlist} stats={data.staticPlaylistStats?.[id]} />
  );
}

function PlaylistPage({
  playlist,
  stats,
}: {
  playlist: SharedPlaylist;
  stats?: PlaylistStats;
}) {
  const colors = useColors();
  const coverSize = useHeroCoverSize();
  const router = useRouter();

  // Failed tracks stay listed, as an album's missing tracks do. The count above
  // them includes them, and the list would otherwise come up short with no reason.
  const { data: liveJobs, isLoading: liveJobsLoading } = usePlaylistJobs(
    playlist.id,
  );
  const canSave = !!liveJobs?.some((job) => job.status === "done");
  const saveOffline = useSaveOffline({
    kind: "playlist",
    id: playlist.id,
    title: playlist.name,
    save:
      canSave && liveJobs
        ? () => savePlaylist({ playlist, jobs: liveJobs })
        : null,
  });
  const savedItem = saveOffline.status?.item;
  const savedJobs = savedItem?.kind === "playlist" ? savedItem.jobs : null;
  const keepUpdated = savedItem?.kind === "playlist" && !!savedItem.keepUpdated;
  // Without Keep Updated, tracks finished since the save aren't on the phone.
  const savedJobIds = useMemo(
    () => new Set(savedJobs?.map((job) => job.id)),
    [savedJobs],
  );
  const holdsEveryTrack =
    saveOffline.status?.state === "saved" &&
    !liveJobs?.some((job) => job.status === "done" && !savedJobIds.has(job.id));
  // A saved playlist still lists and plays its tracks with no connection.
  const jobs = liveJobs ?? savedJobs ?? NO_JOBS;
  const jobsLoading = liveJobsLoading && !savedJobs;
  const saveLine = saveStatusLine(saveOffline.status);
  const collection = useMemo(
    () => ({ ...playlist, kind: "shared" as const }),
    [playlist],
  );
  const { canPlay, playFrom, playAll, shuffle } = usePlaylistPlayback(
    collection,
    jobs,
  );

  const pluginActions = usePluginActions("playlist", {
    playlistId: playlist.id,
  });
  const deletePlaylist = useDeleteSharedPlaylist();
  const deleteTrack = useDeleteSharedPlaylistTrack();

  const deleteMutate = deletePlaylist.mutate;
  const handleDelete = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Playlist",
      `Remove "${playlist.name}"? Its tracks stay in the Library.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          // Leaves first: the refetch a delete triggers can drop the playlist
          // from the snapshot and unmount this page, and a callback here would
          // never run. A failure still reports itself from the hook.
          onPress: () => {
            router.back();
            deleteMutate(playlist.id);
          },
        },
      ],
    );
  }, [playlist.id, playlist.name, router, deleteMutate]);

  const { actionsFor: jobActionsFor, runAction: runJobAction } =
    useTrackJobMenu("shared");
  const deleteTrackMutate = deleteTrack.mutate;
  const handleTrackAction = useCallback(
    (job: FlowJob, id: TrackMenuActionId) => {
      if (runJobAction(job, id) || id !== "remove") return;
      Alert.alert(
        "Remove Track",
        `Remove "${job.trackName}" from "${playlist.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () =>
              deleteTrackMutate({ playlistId: playlist.id, jobId: job.id }),
          },
        ],
      );
    },
    [runJobAction, deleteTrackMutate, playlist.id, playlist.name],
  );

  const trackActions = useTrackActions();
  const { openItem: openTrackItem } = trackActions;
  const queryClient = useQueryClient();
  const playContext = useMemo(
    () => collectionPlayerContext(collection),
    [collection],
  );
  const openTrackSheet = useCallback(
    (job: FlowJob) =>
      openTrackItem(
        jobToPlayerTrack(
          job,
          collection,
          // The cover the page already found, so a save has it offline.
          cachedAlbumCover(queryClient, job.albumMbid),
        ),
        playContext,
        {
          title: job.trackName,
          // Only a finished track has a file of its own. A saved-for-later
          // one streams a clip from elsewhere.
          canSaveOffline: job.status === "done",
          extras: {
            actions: [
              ...jobActionsFor(job),
              { id: "remove", title: "Remove Track", destructive: true },
            ],
            onAction: (id) => handleTrackAction(job, id),
          },
        },
      ),
    [
      openTrackItem,
      collection,
      queryClient,
      playContext,
      jobActionsFor,
      handleTrackAction,
    ],
  );

  const saveState = saveOffline.status?.state ?? null;
  const { remove: removeSave, retry: retrySave } = saveOffline;
  const saveMenu = useMemo(() => {
    const save = (keep: boolean) => {
      if (!liveJobs) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      savePlaylist({ playlist, jobs: liveJobs }, { keepUpdated: keep });
    };
    // Plain elements, not a component, so the Menu sees them as its actions.
    const actions =
      saveState === null
        ? [
            <Stack.Toolbar.MenuAction
              key="save"
              icon={IS_IOS ? "arrow.down.circle" : ArrowCircleDown}
              disabled={!canSave}
              onPress={() => save(false)}
            >
              Save Offline
            </Stack.Toolbar.MenuAction>,
            <Stack.Toolbar.MenuAction
              key="save-updated"
              icon={IS_IOS ? "arrow.triangle.2.circlepath" : Sync}
              disabled={!canSave}
              onPress={() => save(true)}
            >
              Save Offline and Keep Updated
            </Stack.Toolbar.MenuAction>,
          ]
        : [
            <Stack.Toolbar.MenuAction
              key="keep-updated"
              {...checkableMenuItem(
                keepUpdated,
                IS_IOS ? "arrow.triangle.2.circlepath" : Sync,
              )}
              onPress={() => setKeepUpdated(playlist.id, !keepUpdated)}
            >
              Keep Updated
            </Stack.Toolbar.MenuAction>,
            saveState === "incomplete" ? (
              <Stack.Toolbar.MenuAction
                key="retry"
                icon={IS_IOS ? "arrow.clockwise" : Refresh}
                onPress={retrySave}
              >
                Try Again
              </Stack.Toolbar.MenuAction>
            ) : null,
            <Stack.Toolbar.MenuAction
              key="remove"
              icon={IS_IOS ? "xmark.circle" : FileDownloadOff}
              destructive
              onPress={removeSave}
            >
              {saveState === "saving" || saveState === "waiting"
                ? "Stop Saving"
                : "Remove from Phone"}
            </Stack.Toolbar.MenuAction>,
          ];
    return (
      <Stack.Toolbar.Menu
        icon={saveOffline.icon}
        accessibilityLabel={saveOffline.label}
        disabled={saveOffline.disabled}
      >
        {actions}
      </Stack.Toolbar.Menu>
    );
  }, [
    saveState,
    canSave,
    keepUpdated,
    liveJobs,
    playlist,
    removeSave,
    retrySave,
    saveOffline.icon,
    saveOffline.label,
    saveOffline.disabled,
  ]);

  const toolbar = useMemo(
    () => (
      <Stack.Toolbar placement="right">
        {saveMenu}
        <Stack.Toolbar.Menu
          icon={IS_IOS ? "ellipsis" : MoreVert}
          accessibilityLabel="More actions"
        >
          {pluginMenuSection(pluginActions)}
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "trash" : DeleteIcon}
            destructive
            onPress={handleDelete}
          >
            Delete Playlist
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    ),
    [pluginActions, handleDelete, saveMenu],
  );

  const summary = summaryLine(playlist.trackCount, stats);

  return (
    <>
      <CollectionPage
        title={playlist.name}
        jobs={jobs}
        jobsLoading={jobsLoading}
        searchPlaceholder="Search this playlist"
        toolbar={toolbar}
        emptyMessage="No tracks yet"
        onPlayTrack={playFrom}
        onTrackMenuPress={openTrackSheet}
        // A saved playlist's toolbar already says its tracks are on the phone.
        markSavedTracks={!holdsEveryTrack}
        header={
          <>
            <CollectionHero
              name={playlist.name}
              artwork={
                <CollectionArtwork
                  collection={playlist}
                  kind="playlist"
                  stats={stats}
                  size={coverSize}
                  radius={12}
                />
              }
            >
              {playlist.sourceName ? (
                <Text variant="body" style={{ color: colors.subtle }}>
                  from {playlist.sourceName}
                </Text>
              ) : null}
              {summary ? (
                <Text variant="caption" style={{ color: colors.subtle }}>
                  {summary}
                </Text>
              ) : null}
              {saveLine ? (
                <Text variant="caption" style={{ color: colors.subtle }}>
                  {saveLine}
                </Text>
              ) : null}
            </CollectionHero>
            <PlayRow
              title={playlist.name}
              disabled={!canPlay}
              onPlay={() => void playAll()}
              onShuffle={() => void shuffle()}
            >
              <CircleButton
                icon="pencil"
                size={PLAY_ROW_HEIGHT}
                accessibilityLabel={`Edit ${playlist.name}`}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(tabs)/(library)/playlist-edit",
                    params: { id: playlist.id },
                  })
                }
              />
            </PlayRow>
          </>
        }
      />
      <TrackActionsSheet
        target={trackActions.target}
        onClose={trackActions.close}
      />
    </>
  );
}
