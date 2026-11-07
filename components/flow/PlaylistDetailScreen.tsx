import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
  useJobsForPlaylist,
  usePlaylistJobs,
  useSetRetryCyclePaused,
} from "@/hooks/flow";
import { usePlaylistPlayback } from "@/hooks/flow/use-playlist-playback";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import type { FlowJob, PlaylistStats, SharedPlaylist } from "@/lib/types/flow";

export function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <FlowAccessGate message="You don't have access to Playlists">
      <PlaylistLookup id={id} />
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
  const colors = Colors[useColorScheme()];
  const router = useRouter();

  // Failed tracks stay listed, as an album's missing tracks do. The count above
  // them includes them, and the list would otherwise come up short with no reason.
  const jobs = useJobsForPlaylist(playlist.id, { includeFailed: true });
  // Same cache entry as useJobsForPlaylist; only the initial-load flag is read.
  const jobsLoading = usePlaylistJobs(playlist.id).isLoading;
  const { canPlay, playFrom, playAll, shuffle } = usePlaylistPlayback(
    playlist,
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

  const deleteTrackMutate = deleteTrack.mutate;
  const trackMenuAction = useCallback(
    (job: FlowJob) => () =>
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
      ),
    [deleteTrackMutate, playlist.id, playlist.name],
  );

  const isRetryPending = setRetryPaused.isPending;
  const setRetryMutate = setRetryPaused.mutate;
  const toolbar = useMemo(
    () => (
      <Stack.Toolbar placement="right">
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
    [retryPaused, isRetryPending, setRetryMutate, playlist.id, handleDelete],
  );

  const summary = summaryLine(playlist.trackCount, stats);

  return (
    <CollectionPage
      title={playlist.name}
      jobs={jobs}
      jobsLoading={jobsLoading}
      searchPlaceholder="Search this playlist"
      toolbar={toolbar}
      emptyMessage="No tracks yet"
      onPlayTrack={playFrom}
      trackMenuAction={trackMenuAction}
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
  );
}
