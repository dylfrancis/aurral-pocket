import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import PauseIcon from "@expo/material-symbols/pause.xml";
import PlayArrow from "@expo/material-symbols/play_arrow.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";

import { EmptyState } from "@/components/library/EmptyState";
import { Chip } from "@/components/ui/Chip";
import { CircleButton } from "@/components/ui/CircleButton";
import { PLAY_ROW_HEIGHT, PlayRow } from "@/components/ui/PlayRow";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { Text } from "@/components/ui/Text";
import { CollectionArtwork } from "./CollectionArtwork";
import {
  COVER_SIZE,
  CollectionHero,
  CollectionPage,
  summaryLine,
} from "./CollectionPage";
import { FlowAccessGate } from "./FlowAccessGate";
import {
  useDeleteSharedPlaylist,
  useDeleteSharedPlaylistTrack,
  useFlowStatusSuspense,
  usePlaylistJobs,
  useSetRetryCyclePaused,
  useTrackJobMenu,
} from "@/hooks/flow";
import { usePlaylistPlayback } from "@/hooks/flow/use-playlist-playback";
import { useSaveOffline } from "@/hooks/offline/use-save-offline";
import { cachedAlbumCover } from "@/hooks/player/queue-covers";
import {
  collectionPlayerContext,
  jobToPlayerTrack,
} from "@/lib/player/track-item";
import { saveStatusLine } from "@/lib/offline/format";
import { useIsOffline } from "@/lib/offline/network";
import { savePlaylist, useSavedStatus } from "@/lib/offline/saved-library";
import {
  TrackActionsSheet,
  useTrackActions,
} from "@/components/library/TrackActionsSheet";
import type { TrackMenuActionId } from "@/components/player/track-menu-types";
import { IS_IOS } from "@/constants/platform";
import type { FlowJob, PlaylistStats, SharedPlaylist } from "@/lib/types/flow";
import { useColors } from "@/hooks/use-colors";

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
        <PlaylistPage playlist={saved.playlist} retryPaused={false} />
      ) : (
        <PlaylistLookup id={id} />
      )}
    </FlowAccessGate>
  );
}

function PlaylistLookup({ id }: { id: string }) {
  const { data } = useFlowStatusSuspense();
  const playlist = data.sharedPlaylists.find((entry) => entry.id === id);

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
    <PlaylistPage
      playlist={playlist}
      stats={data.sharedPlaylistStats?.[id]}
      retryPaused={!!data.retryCyclePausedByPlaylist?.[id]}
    />
  );
}

function PlaylistPage({
  playlist,
  stats,
  retryPaused,
}: {
  playlist: SharedPlaylist;
  stats?: PlaylistStats;
  retryPaused: boolean;
}) {
  const colors = useColors();
  const router = useRouter();

  // Failed tracks stay listed, as an album's missing tracks do. The count above
  // them includes them, and the list would otherwise come up short with no reason.
  const { data: liveJobs, isLoading: liveJobsLoading } = usePlaylistJobs(
    playlist.id,
  );
  const saveOffline = useSaveOffline({
    kind: "playlist",
    id: playlist.id,
    title: playlist.name,
    save: liveJobs?.some((job) => job.status === "done")
      ? () => savePlaylist({ playlist, jobs: liveJobs })
      : null,
  });
  const savedItem = saveOffline.status?.item;
  const savedJobs = savedItem?.kind === "playlist" ? savedItem.jobs : null;
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

  const deletePlaylist = useDeleteSharedPlaylist();
  const deleteTrack = useDeleteSharedPlaylistTrack();
  const setRetryPaused = useSetRetryCyclePaused();

  const deleteMutate = deletePlaylist.mutate;
  const handleDelete = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Playlist",
      `Remove "${playlist.name}"? Its files will be cleaned up.`,
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

  const isRetryPending = setRetryPaused.isPending;
  const setRetryMutate = setRetryPaused.mutate;
  const toolbar = useMemo(
    () => (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={saveOffline.icon}
          accessibilityLabel={saveOffline.label}
          disabled={saveOffline.disabled}
          onPress={saveOffline.onPress}
        >
          {saveOffline.label}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Menu
          icon={IS_IOS ? "ellipsis" : MoreVert}
          accessibilityLabel="More actions"
        >
          <Stack.Toolbar.MenuAction
            icon={
              retryPaused
                ? IS_IOS
                  ? "play"
                  : PlayArrow
                : IS_IOS
                  ? "pause"
                  : PauseIcon
            }
            disabled={isRetryPending}
            onPress={() =>
              setRetryMutate({
                playlistId: playlist.id,
                paused: !retryPaused,
              })
            }
          >
            {retryPaused ? "Resume Retry" : "Pause Retry"}
          </Stack.Toolbar.MenuAction>
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
    [
      retryPaused,
      isRetryPending,
      setRetryMutate,
      playlist.id,
      handleDelete,
      saveOffline.icon,
      saveOffline.label,
      saveOffline.disabled,
      saveOffline.onPress,
    ],
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
        markSavedTracks={saveOffline.status?.state !== "saved"}
        header={
          <>
            <CollectionHero
              name={playlist.name}
              artwork={
                <CollectionArtwork
                  collection={playlist}
                  kind="playlist"
                  stats={stats}
                  size={COVER_SIZE}
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
              {retryPaused ? (
                <Chip label="Retry paused" icon="pause" variant="subtle" />
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
