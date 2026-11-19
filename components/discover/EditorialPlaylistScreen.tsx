import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";

import { ScrollHeaderTitle } from "@/components/artist/ArtistDetailLayout";
import { CollectionHero, COVER_SIZE } from "@/components/flow/CollectionPage";
import { EmptyState } from "@/components/library/EmptyState";
import {
  TrackActionsSheet,
  useTrackActions,
} from "@/components/library/TrackActionsSheet";
import { CircleButton } from "@/components/ui/CircleButton";
import { PLAY_ROW_HEIGHT, PlayRow } from "@/components/ui/PlayRow";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { Text } from "@/components/ui/Text";
import { IS_IOS } from "@/constants/platform";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import {
  useAddEditorialPlaylist,
  useEditorialPlaylist,
} from "@/hooks/discover/use-editorial-playlists";
import { rowPlayerId, useRowLinks } from "@/hooks/discover/use-preview-rows";
import { useOpenPlaylist } from "@/hooks/flow/use-open-playlist";
import { stopPreviewClip } from "@/hooks/library/use-audio-preview";
import { useStartQueue } from "@/hooks/player/use-start-queue";
import { ApiError } from "@/lib/api/client";
import { requestTrackDownload } from "@/lib/api/library";
import {
  editorialClipItem,
  editorialContext,
  editorialQueue,
} from "@/lib/discover/editorial-queue";
import { formatTrackCount } from "@/lib/discover/format";
import { playItem, togglePlayback, useCurrentTrack } from "@/lib/player/player";
import { queueTrackToPlayerTrack } from "@/lib/player/track-item";
import type { BrowseProvider } from "@/lib/types/search";
import { BrowseTrackRow, type TrackDownloadState } from "./BrowseTrackRow";
import { EditorialArtwork } from "./EditorialArtwork";
import type { EditorialTrackItem } from "./EditorialTrackRow";
import { useColors } from "@/hooks/use-colors";

const GONE_MESSAGE: Record<BrowseProvider, string> = {
  deezer: "Deezer no longer has this playlist",
  discovery: "This playlist was replaced by a newer one",
  mix: "This mix was replaced by a newer one",
};

type RouteParams = {
  provider: BrowseProvider;
  id: string;
  name?: string;
  artworkUrl?: string;
  trackCount?: string;
};

/**
 * A Browse playlist (a mix, Made for You, or a Deezer playlist) laid out like
 * an album: Shuffle, Play and + up top, and rows that play when tapped. Play
 * takes the songs the Library has. The rest are grayed: a tap plays the clip,
 * and ↓ asks Aurral to download the song.
 */
export function EditorialPlaylistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Only iOS scrolls under its translucent header.
  const headerHeight = useHeaderHeight();
  const headerPaddingTop = (IS_IOS ? headerHeight : 0) + 24;
  const params = useLocalSearchParams<RouteParams>();
  const { provider, id } = params;

  const {
    data: playlist,
    error,
    isPending,
    refetch,
  } = useEditorialPlaylist(provider, id);
  const addPlaylist = useAddEditorialPlaylist(provider, id);
  const openInLibrary = useOpenPlaylist();
  const hasPermission = useHasPermission();
  const hasPlaylistAccess = hasPermission("accessPlaylists");
  const canDownload = hasPermission("addAlbum");

  // Leaving the page must not leave a clip playing behind it.
  useEffect(() => () => stopPreviewClip(), []);
  const { lookupRowId, openRowArtist, openRowAlbum } =
    useRowLinks(stopPreviewClip);

  const trackItems = useMemo<EditorialTrackItem[]>(
    () =>
      (playlist?.tracks ?? []).map((track, index) => ({
        id: `${provider}-${id}-${index}`,
        track,
      })),
    [playlist?.tracks, provider, id],
  );
  const hasLibrarySongs = trackItems.some(({ track }) => !!track.owned);

  const startQueue = useStartQueue();
  const playLibrarySongs = useCallback(
    (options: { shuffled?: boolean; startId?: string } = {}) => {
      if (!playlist) return;
      // Built at the tap: each URL carries the session token.
      void startQueue(
        editorialQueue(playlist),
        editorialContext(playlist),
        options,
      );
    },
    [playlist, startQueue],
  );

  const currentId = useCurrentTrack()?.id ?? null;
  const handleRowPress = useCallback(
    (item: EditorialTrackItem) => {
      void Haptics.selectionAsync();
      const playerId = rowPlayerId(item);
      // The row already playing pauses or resumes.
      if (playerId === currentId) {
        void togglePlayback();
        return;
      }
      if (item.track.owned) {
        playLibrarySongs({ startId: playerId });
        return;
      }
      const clip = editorialClipItem(item.id, item.track);
      if (clip) void playItem(clip);
    },
    [currentId, playLibrarySongs],
  );

  const trackActions = useTrackActions();
  const openRowActions = useCallback(
    (item: EditorialTrackItem) => {
      const { owned } = item.track;
      trackActions.openItem(
        owned
          ? queueTrackToPlayerTrack(owned, item.track.artworkUrl)
          : editorialClipItem(item.id, item.track),
        editorialContext({ name: playlist?.name ?? params.name ?? "" }),
        {
          title: item.track.trackName,
          // A clip is only a cut of the song, not a file to keep.
          canSaveOffline: !!owned,
        },
      );
    },
    [trackActions, playlist?.name, params.name],
  );

  // Each ↓ remembers its request, so a second tap can't ask twice.
  const [downloads, setDownloads] = useState<
    Record<string, TrackDownloadState>
  >({});
  const download = useMutation({
    mutationFn: (item: EditorialTrackItem) =>
      requestTrackDownload({
        artistName: item.track.artistName,
        trackName: item.track.trackName,
        albumName: item.track.albumName,
      }),
    onMutate: (item) =>
      setDownloads((current) => ({ ...current, [item.id]: "sending" })),
    onSuccess: (result, item) => {
      setDownloads((current) => ({ ...current, [item.id]: "queued" }));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Android shows only a toast's title, so the song goes there.
      Burnt.toast({
        title: result.alreadyOwned
          ? `${item.track.trackName} is in your Library`
          : `Downloading ${item.track.trackName}`,
        preset: "done",
      });
    },
    onError: (requestError, item) => {
      setDownloads((current) => ({ ...current, [item.id]: "idle" }));
      Burnt.toast({
        title: "Couldn't download this song",
        message:
          requestError instanceof ApiError ? requestError.message : undefined,
        preset: "error",
      });
    },
  });
  const requestDownload = download.mutate;
  const handleDownload = useCallback(
    (item: EditorialTrackItem) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      requestDownload(item);
    },
    [requestDownload],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: EditorialTrackItem; index: number }) => (
      <BrowseTrackRow
        item={item}
        position={index + 1}
        playerId={rowPlayerId(item)}
        isLookingUpLink={lookupRowId === item.id}
        onPress={handleRowPress}
        onOpenActions={openRowActions}
        onOpenArtist={openRowArtist}
        onOpenAlbum={openRowAlbum}
        onDownload={canDownload ? handleDownload : undefined}
        downloadState={downloads[item.id]}
      />
    ),
    [
      lookupRowId,
      handleRowPress,
      openRowActions,
      openRowArtist,
      openRowAlbum,
      canDownload,
      handleDownload,
      downloads,
    ],
  );

  const name = playlist?.name ?? params.name ?? "";

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  if (!playlist && !isPending) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <ScreenCenter>
        <EmptyState
          icon="alert-circle-outline"
          message={
            notFound
              ? (GONE_MESSAGE[provider] ??
                "This playlist is no longer available")
              : "Couldn't load this playlist"
          }
          actionLabel={notFound ? undefined : "Try Again"}
          onAction={notFound ? undefined : () => void refetch()}
        />
      </ScreenCenter>
    );
  }

  // A deep link has no card to paint the header from.
  if (!name) return <ScreenCenter loading />;

  const trackCount = playlist?.tracks.length ?? Number(params.trackCount ?? 0);
  const metaLine = [playlist?.curator, formatTrackCount(trackCount)]
    .filter(Boolean)
    .join(" · ");
  const libraryPlaylistId = playlist?.libraryPlaylistId;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollHeaderTitle name={name} scrollY={scrollY} />
      <Animated.FlatList
        data={trackItems}
        renderItem={renderItem}
        keyExtractor={(item: EditorialTrackItem) => item.id}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ListHeaderComponent={
          <View style={{ paddingTop: headerPaddingTop }}>
            <CollectionHero
              name={name}
              artwork={
                <EditorialArtwork
                  name={name}
                  coverUrl={playlist?.artworkUrl ?? params.artworkUrl ?? null}
                  size={COVER_SIZE}
                  radius={12}
                />
              }
            >
              {playlist?.description ? (
                <Text
                  variant="body"
                  numberOfLines={3}
                  style={[styles.description, { color: colors.subtle }]}
                >
                  {playlist.description}
                </Text>
              ) : null}
              {metaLine ? <Text variant="caption">{metaLine}</Text> : null}
            </CollectionHero>
            <PlayRow
              title={name}
              disabled={!hasLibrarySongs}
              onPlay={() => playLibrarySongs()}
              onShuffle={() => playLibrarySongs({ shuffled: true })}
            >
              {/* Where the album page's heart goes. The spacer keeps Play
                  centered for someone who can't save playlists. */}
              {!hasPlaylistAccess ? (
                <View style={styles.circleSpacer} />
              ) : libraryPlaylistId ? (
                <CircleButton
                  icon="checkmark"
                  size={PLAY_ROW_HEIGHT}
                  accessibilityLabel={`Open ${name} in your Library`}
                  onPress={() => {
                    stopPreviewClip();
                    void openInLibrary(libraryPlaylistId);
                  }}
                />
              ) : (
                // Only a loaded playlist says whether this makes a second
                // copy.
                <CircleButton
                  icon="add"
                  size={PLAY_ROW_HEIGHT}
                  accessibilityLabel={`Add ${name} to your Library`}
                  disabled={!playlist || addPlaylist.isPending}
                  onPress={() => addPlaylist.mutate()}
                />
              )}
            </PlayRow>
          </View>
        }
        ListEmptyComponent={
          isPending ? (
            <ActivityIndicator style={styles.loader} color={colors.brand} />
          ) : (
            <Text variant="caption" style={styles.emptyText}>
              This playlist has no tracks
            </Text>
          )
        }
      />
      <TrackActionsSheet
        target={trackActions.target}
        onClose={trackActions.close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    textAlign: "center",
  },
  circleSpacer: {
    width: PLAY_ROW_HEIGHT,
    height: PLAY_ROW_HEIGHT,
  },
  loader: {
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
});
