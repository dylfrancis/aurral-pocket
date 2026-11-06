import { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import PlaylistPlay from "@expo/material-symbols/playlist_play.xml";
import QueueMusic from "@expo/material-symbols/queue_music.xml";
import SearchIcon from "@expo/material-symbols/search.xml";
import OpenInNew from "@expo/material-symbols/open_in_new.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";

import { ScrollHeaderTitle } from "@/components/artist/ArtistDetailLayout";
import { CircleButton } from "@/components/ui/CircleButton";
import { Text } from "@/components/ui/Text";
import { AlbumStatusBadge } from "./AlbumStatusBadge";
import { CoverArtImage } from "./CoverArtImage";
import { TrackActionsSheet, useTrackActions } from "./TrackActionsSheet";
import { TrackRow } from "./TrackRow";
import { useCoverArtUrl } from "@/hooks/library/use-cover-art-url";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { useLibraryAlbum } from "@/hooks/library/use-library-albums";
import { useToggleFavorite } from "@/hooks/library/use-library-favorites";
import { useLibraryTracks } from "@/hooks/library/use-library-tracks";
import { usePlayTrack } from "@/hooks/library/use-play-track";
import { useQueueActions } from "@/hooks/library/use-queue-actions";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { deleteAlbum, triggerAlbumSearch } from "@/lib/api/library";
import { albumDownloadStatus, libraryAlbumsRef } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import { Colors, Fonts } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import type { DownloadStatusValue } from "@/lib/types/library";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COVER_SIZE = Math.min(SCREEN_WIDTH - 120, 260);
const PLAY_ROW_HEIGHT = 50;

type AlbumRouteParams = {
  ref: string;
  lidarrAlbumId?: string;
  downloadStatus?: string;
  albumMbid?: string;
  canonicalAlbumId?: string;
  title?: string;
  artistName?: string;
  artistMbid?: string;
  artistId?: string;
  coverUrl?: string;
};

/**
 * The album page, reached as `/album/[ref]` from every tab that can show a
 * library album.
 *
 * It loads its own data rather than taking an album prop. The groups that
 * route here arrive from different lists — an artist's albums, a
 * whole-library grid, a genre, a favorites row — and threading an Album
 * through all of them is what kept this a bottom sheet.
 *
 * The route params carry enough to paint the header on the first frame. The
 * canonical read then supplies fresh statistics for the badge and for the
 * re-search condition. When the reference is not a canonical id that read is
 * null and the page still works from the params alone.
 */
export function AlbumDetailScreen() {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  // iOS keeps a translucent header, so contentOffset 0 sits *under* the nav
  // bar and the cover would start behind it. Android's header is opaque and
  // the scroll view already starts below it, so it only needs breathing room.
  const headerHeight = useHeaderHeight();
  const heroPaddingTop = (IS_IOS ? headerHeight : 0) + 24;
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<AlbumRouteParams>();

  const { data: album, isPending: albumPending } = useLibraryAlbum(params.ref);
  const { data: tracks, isLoading: tracksLoading } = useLibraryTracks(
    params.ref,
  );
  // One album, so the polled id set stays small.
  const { data: downloadStatuses } = useDownloadStatuses(
    album ? [album] : undefined,
  );
  // The live query wins once it has an answer; until then the status the
  // calling row already showed stands, so the two never contradict.
  const downloadStatus =
    (album ? albumDownloadStatus(downloadStatuses, album) : undefined) ??
    (params.downloadStatus as DownloadStatusValue | undefined) ??
    undefined;

  const albumMbid = params.albumMbid || album?.mbid || "";
  // The live record wins over the row that opened the page, which may carry
  // a cover version from before the artwork changed.
  const coverUrl = album?.coverUrl || params.coverUrl;
  const title = album?.albumName || params.title || "";
  const artistName = params.artistName || album?.artistName || "";
  // Lidarr owns delete and re-search, so both need Lidarr's own album id.
  // `ref` is a canonical id, and Lidarr would read it as some other album.
  // The live record wins once it loads, as for the status above. An album
  // Lidarr does not manage has no id, and the page hides both actions.
  const lidarrAlbumId = (album ? album.lidarrId : params.lidarrAlbumId) || "";

  // For the player, when the server has no cover to give it.
  const { url: artworkUrl } = useCoverArtUrl({
    type: "album",
    mbid: albumMbid || undefined,
  });

  const playContext: PlayerAlbumContext = {
    albumTitle: title,
    artistName,
    coverPath: coverUrl || null,
    artworkUrl,
    albumMbid: albumMbid || null,
    artistMbid: params.artistMbid || null,
  };

  const play = usePlayTrack();
  const { playNext, addToQueue, playAlbum, shuffleAlbum } = useQueueActions();

  const trackActions = useTrackActions();
  const toggleFavorite = useToggleFavorite();
  // The heart answers the tap at once. The toggle stays pending until the album
  // is reread, and a refused toggle falls back to the album's own flag.
  const isFavorite = toggleFavorite.isPending
    ? toggleFavorite.variables.starred
    : album?.userFavorite === true;
  const handleToggleFavorite = () => {
    if (!album?.identityKey || toggleFavorite.isPending) return;
    toggleFavorite.mutate({
      kind: "album",
      identityKey: album.identityKey,
      starred: !isFavorite,
    });
  };

  const year = album?.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;
  const trackCount = album?.statistics.trackCount ?? tracks?.length ?? 0;
  // Unknown reads as complete, so a page with no canonical record does not
  // offer to re-search an album it knows nothing about.
  const isComplete = album
    ? album.statistics.percentOfTracks >= 100 || album.statistics.sizeOnDisk > 0
    : true;
  const showResearch =
    !!lidarrAlbumId &&
    !isComplete &&
    (!downloadStatus || downloadStatus === "failed");

  const searchMutation = useMutation({
    mutationFn: () => triggerAlbumSearch(lidarrAlbumId),
    onMutate: () => {
      queryClient.setQueriesData<Record<string, { status: string }>>(
        { queryKey: libraryKeys.downloadStatusesAll() },
        (old) => ({ ...(old ?? {}), [lidarrAlbumId]: { status: "searching" } }),
      );
    },
    // Settled, not success: a rejected search left the optimistic "searching"
    // standing for good, because nothing refetched it. The row that launched
    // this page polls on its own and would move on to the real status, so the
    // two disagreed until the page was closed.
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.downloadStatusesAll(),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAlbum(lidarrAlbumId),
    onSuccess: () => {
      const artistRef = libraryAlbumsRef({
        artistId: params.artistId || album?.artistId,
        artistMbid: params.artistMbid,
      });
      if (artistRef) {
        void queryClient.invalidateQueries({
          queryKey: libraryKeys.albums(artistRef),
        });
      }
      // The Albums or Genres screen may sit under this page, still counting
      // the album.
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.albumsAllViews(),
      });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.genres() });
      // The album this page is about is gone, so the page cannot stay.
      router.back();
    },
  });

  const handleLastFm = useCallback(() => {
    if (!artistName || !title) return;
    void Linking.openURL(
      `https://www.last.fm/music/${encodeURIComponent(artistName)}/${encodeURIComponent(title)}`,
    );
  }, [artistName, title]);

  const handleDelete = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Delete Album", `Remove "${title}" from your library?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  }, [title, deleteMutation]);

  const openArtist = useCallback(() => {
    if (!params.artistMbid) return;
    router.push({
      pathname: "/artist/[mbid]",
      params: { mbid: params.artistMbid, name: artistName },
    });
  }, [router, params.artistMbid, artistName]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const albumTracks = tracks ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <ScrollHeaderTitle name={title} scrollY={scrollY} />
          ),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={IS_IOS ? "ellipsis" : MoreVert}
          accessibilityLabel="More actions"
        >
          <Stack.Toolbar.MenuAction
            icon={
              IS_IOS
                ? "text.line.first.and.arrowtriangle.forward"
                : PlaylistPlay
            }
            onPress={() => void playNext(albumTracks, playContext)}
          >
            Play Next
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "text.badge.plus" : QueueMusic}
            onPress={() => void addToQueue(albumTracks, playContext)}
          >
            Add to Queue
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "magnifyingglass" : SearchIcon}
            hidden={!showResearch}
            disabled={searchMutation.isPending}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              searchMutation.mutate();
            }}
          >
            {searchMutation.isPending ? "Searching…" : "Re-search"}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "arrow.up.right.square" : OpenInNew}
            hidden={!artistName || !title}
            onPress={handleLastFm}
          >
            View on Last.fm
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "trash" : DeleteIcon}
            // Native menus only offer the platform destructive style, so this
            // red is the system red rather than the theme's error token.
            destructive
            hidden={!lidarrAlbumId}
            disabled={deleteMutation.isPending}
            onPress={handleDelete}
          >
            Delete Album
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={[styles.hero, { paddingTop: heroPaddingTop }]}>
          <CoverArtImage
            type="album"
            mbid={albumMbid}
            coverUrl={coverUrl}
            size={COVER_SIZE}
            borderRadius={12}
          />
          <Text variant="title" style={styles.albumName}>
            {title}
          </Text>
          <Pressable
            onPress={openArtist}
            disabled={!params.artistMbid}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text
              variant="body"
              style={[
                styles.artistName,
                { color: params.artistMbid ? colors.brand : colors.subtle },
              ]}
            >
              {artistName}
            </Text>
          </Pressable>
          <Text variant="caption" style={{ color: colors.subtle }}>
            {[
              year,
              trackCount
                ? `${trackCount} track${trackCount === 1 ? "" : "s"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {album && (
            <AlbumStatusBadge album={album} downloadStatus={downloadStatus} />
          )}
        </View>

        <View style={styles.playRow}>
          <CircleButton
            icon="shuffle"
            size={PLAY_ROW_HEIGHT}
            accessibilityLabel={`Shuffle ${title}`}
            onPress={() => void shuffleAlbum(albumTracks, playContext)}
            disabled={albumTracks.length === 0}
          />
          <PlayButton
            onPress={() => void playAlbum(albumTracks, playContext)}
            disabled={albumTracks.length === 0}
          />
          {/* Shows while the album loads, so the heart doesn't pop in. The
              spacer keeps Play centered when the album can't be favorited. */}
          {albumPending || album?.identityKey ? (
            <CircleButton
              icon={isFavorite ? "heart" : "heart-outline"}
              size={PLAY_ROW_HEIGHT}
              accessibilityLabel={
                isFavorite
                  ? `Remove ${title} from favorites`
                  : `Add ${title} to favorites`
              }
              onPress={handleToggleFavorite}
            />
          ) : (
            <View style={styles.circleSpacer} />
          )}
        </View>

        {tracksLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.brand} />
        ) : albumTracks.length > 0 ? (
          albumTracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onPress={() => void play(albumTracks, track, playContext)}
              onLongPress={() => trackActions.open(track, playContext)}
              onMenuPress={() => trackActions.open(track, playContext)}
            />
          ))
        ) : (
          <Text variant="caption" style={styles.emptyText}>
            No tracks available
          </Text>
        )}
      </Animated.ScrollView>

      <TrackActionsSheet
        target={trackActions.target}
        onClose={trackActions.close}
      />
    </View>
  );
}

function PlayButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = Colors[useColorScheme()];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.playButton,
        {
          backgroundColor: colors.brand,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons name="play" size={18} color={colors.buttonPrimaryText} />
      <Text
        variant="body"
        style={[styles.playLabel, { color: colors.buttonPrimaryText }]}
      >
        Play
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  albumName: {
    textAlign: "center",
    marginTop: 8,
  },
  artistName: {
    textAlign: "center",
    ...Fonts.medium,
  },
  playRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: PLAY_ROW_HEIGHT * 3,
    height: PLAY_ROW_HEIGHT,
    borderRadius: PLAY_ROW_HEIGHT / 2,
    borderCurve: "continuous",
  },
  circleSpacer: {
    width: PLAY_ROW_HEIGHT,
  },
  playLabel: {
    ...Fonts.semiBold,
  },
  loader: {
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 32,
  },
});
