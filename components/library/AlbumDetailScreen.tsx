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
import * as Haptics from "expo-haptics";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import PlaylistPlay from "@expo/material-symbols/playlist_play.xml";
import QueueMusic from "@expo/material-symbols/queue_music.xml";
import SearchIcon from "@expo/material-symbols/search.xml";
import OpenInNew from "@expo/material-symbols/open_in_new.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";

import { ScrollHeaderTitle } from "@/components/artist/ArtistDetailLayout";
import { CoverTintBackdrop } from "@/components/player/CoverTintBackdrop";
import {
  ARTWORK_SHADOW,
  PlayerColors,
} from "@/components/player/player-colors";
import { CircleButton } from "@/components/ui/CircleButton";
import { PLAY_ROW_HEIGHT, PlayRow } from "@/components/ui/PlayRow";
import { Text } from "@/components/ui/Text";
import { AlbumStatusBadge } from "./AlbumStatusBadge";
import { CoverArtImage } from "./CoverArtImage";
import { TrackActionsSheet, useTrackActions } from "./TrackActionsSheet";
import { TrackRow } from "./TrackRow";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useCoverArtUrl } from "@/hooks/library/use-cover-art-url";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { useLibraryAlbum } from "@/hooks/library/use-library-albums";
import { useToggleFavorite } from "@/hooks/library/use-library-favorites";
import { useLibraryTracks } from "@/hooks/library/use-library-tracks";
import { usePlayTrack } from "@/hooks/library/use-play-track";
import { useQueueActions } from "@/hooks/library/use-queue-actions";
import { useCoverTint } from "@/hooks/player/use-cover-color";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { canResearchAurralAlbum, isUnreleased } from "@/lib/album-status";
import {
  deleteAlbum,
  deleteAurralAlbum,
  researchAurralAlbum,
  triggerAlbumSearch,
} from "@/lib/api/library";
import {
  albumDownloadStatus,
  albumManager,
  albumStatusKey,
  libraryAlbumsRef,
} from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import { Colors, Fonts } from "@/constants/theme";
import { IS_ANDROID, IS_IOS } from "@/constants/platform";
import type {
  DownloadStatusMap,
  DownloadStatusValue,
} from "@/lib/types/library";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COVER_SIZE = Math.min(SCREEN_WIDTH - 120, 260);
const COVER_RADIUS = 12;
/** Covers the iOS header above the hero, and the room a pull-down opens. */
const TINT_BLEED = Dimensions.get("window").height;
/** The play row sits below the fade, on the plain background the brand green is made for. */
const HERO_FADE_STOPS = [0.35, 1] as const;

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
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const heroColors = PlayerColors[scheme];
  const insets = useSafeAreaInsets();
  // iOS insets the scroll view below its translucent header. Content that
  // starts under the bar gets the header's edge dimming even at rest, which
  // darkened the tint there. The offset then starts at minus the header's
  // height, so the title fade adds it back. Android's header is opaque and
  // the scroll view starts below it.
  const headerHeight = useHeaderHeight();
  const restingOffset = IS_IOS ? headerHeight : 0;
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasPermission = useHasPermission();
  const params = useLocalSearchParams<AlbumRouteParams>();

  const { data: album, isPending: albumLoading } = useLibraryAlbum(params.ref);
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
  const artistMbid = params.artistMbid || album?.artistMbid || "";
  // `ref` is a canonical id, which Lidarr would read as some other album.
  // Until the record loads, the row that opened the page names Lidarr's id;
  // only the record says Aurral manages an album.
  const ownership = album ?? { lidarrId: params.lidarrAlbumId };
  const manager = albumManager(ownership);
  const statusKey = albumStatusKey(ownership);
  const aurralAlbum = manager?.name === "aurral" ? album : undefined;

  // For the player, when the server has no cover to give it.
  const { url: artworkUrl } = useCoverArtUrl({
    type: "album",
    mbid: albumMbid || undefined,
  });
  // The same two sources the hero cover loads from, in its order.
  const tint = useCoverTint({ coverPath: coverUrl, artwork: artworkUrl });

  const playContext: PlayerAlbumContext = {
    albumTitle: title,
    artistName,
    coverPath: coverUrl || null,
    artworkUrl,
    albumMbid: albumMbid || null,
    artistMbid: params.artistMbid || null,
    albumRef: params.ref,
  };

  const play = usePlayTrack();
  const { playNext, addToQueue, playAlbum, shuffleAlbum } = useQueueActions();

  const trackActions = useTrackActions();
  const toggleFavorite = useToggleFavorite();
  // Shows the tap at once. A refused toggle falls back to the album's own flag.
  const isFavorite = toggleFavorite.isPending
    ? toggleFavorite.variables.starred
    : album?.userFavorite === true;
  const handleToggleFavorite = () => {
    if (!album?.identityKey || toggleFavorite.isPending) return;
    toggleFavorite.mutate({
      kind: "album",
      key: album.identityKey,
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
  // Re-searching an unmonitored Aurral album monitors it, which takes
  // changeMonitoring. A monitored one is requested again, which takes
  // addAlbum and names the artist.
  const canResearchAurral =
    !!aurralAlbum &&
    canResearchAurralAlbum(aurralAlbum, downloadStatus) &&
    (aurralAlbum.monitored
      ? hasPermission("addAlbum") && !!artistMbid && !!artistName
      : hasPermission("changeMonitoring"));
  const showResearch =
    !isComplete &&
    (manager?.name === "aurral"
      ? canResearchAurral
      : !!manager && (!downloadStatus || downloadStatus === "failed"));
  // Monitoring an album that isn't out yet only schedules its download.
  const researchLabel =
    aurralAlbum &&
    !aurralAlbum.monitored &&
    isUnreleased(aurralAlbum.releaseDate)
      ? "Download When It's Out"
      : "Re-search";
  const showDelete =
    manager?.name === "aurral" ? hasPermission("deleteAlbum") : !!manager;

  const setCachedStatus = (entry: DownloadStatusMap[string]) => {
    if (!statusKey) return;
    queryClient.setQueriesData<DownloadStatusMap>(
      { queryKey: libraryKeys.downloadStatusesAll() },
      (old) => ({ ...(old ?? {}), [statusKey]: entry }),
    );
  };

  const searchMutation = useMutation({
    mutationFn: async () => {
      if (manager?.name === "lidarr") {
        await triggerAlbumSearch(manager.albumId);
        return null;
      }
      if (manager?.name !== "aurral" || !aurralAlbum) return null;
      return researchAurralAlbum(
        { ...aurralAlbum, canonicalId: manager.albumId },
        { mbid: artistMbid, name: artistName },
      );
    },
    onMutate: () => {
      if (manager?.name === "lidarr") setCachedStatus({ status: "searching" });
    },
    // Aurral's answer can be a release date to wait for, which a guess here
    // would have shown as Queued.
    onSuccess: (albumStatus) => {
      if (albumStatus) setCachedStatus(albumStatus);
    },
    // Settled, not success: a rejected search left the optimistic "searching"
    // standing for good, because nothing refetched it. The row that launched
    // this page polls on its own and would move on to the real status, so the
    // two disagreed until the page was closed.
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.downloadStatusesAll(),
      });
      // Re-searching an unmonitored Aurral album monitored it.
      if (aurralAlbum && !aurralAlbum.monitored) {
        void queryClient.invalidateQueries({
          queryKey: libraryKeys.album(params.ref),
        });
        invalidateArtistAlbums();
      }
    },
  });

  function invalidateArtistAlbums() {
    const artistRef = libraryAlbumsRef({
      artistId: params.artistId || album?.artistId,
      artistMbid: params.artistMbid,
    });
    if (artistRef) {
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.albums(artistRef),
      });
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (manager?.name === "aurral") {
        // Kept files would bring the album back on the next full scan.
        await deleteAurralAlbum(manager.albumId, true);
      } else if (manager) {
        await deleteAlbum(manager.albumId);
      }
    },
    onSuccess: () => {
      invalidateArtistAlbums();
      // The Albums or Genres screen may sit under this page, still counting
      // the album.
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.albumsAllViews(),
      });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.genres() });
      // Aurral removes an artist along with its last album.
      void queryClient.invalidateQueries({ queryKey: libraryKeys.artists() });
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
    const message =
      manager?.name === "aurral"
        ? `Delete "${title}" and its files? Aurral won't download it again.`
        : `Remove "${title}" from your library?`;
    Alert.alert("Delete Album", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  }, [title, manager?.name, deleteMutation]);

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
      scrollY.value = event.contentOffset.y + restingOffset;
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
          // The opaque header carries the tint, so it meets the hero's
          // without a seam. iOS draws the hero's own tint under its header.
          ...(IS_ANDROID && { headerStyle: { backgroundColor: tint } }),
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
            {searchMutation.isPending ? "Searching…" : researchLabel}
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
            hidden={!showDelete}
            disabled={deleteMutation.isPending}
            onPress={handleDelete}
          >
            Delete Album
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      <Animated.ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          // The automatic inset already clears the iOS tab bar.
          paddingBottom: (IS_IOS ? 0 : insets.bottom) + 16,
        }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={styles.hero}>
          <CoverTintBackdrop
            tint={tint}
            fadeStops={HERO_FADE_STOPS}
            bleed={TINT_BLEED}
            // Android's header can't ease, so the hero switches with it.
            animated={IS_IOS}
          />
          <View style={styles.cover}>
            <CoverArtImage
              type="album"
              mbid={albumMbid}
              coverUrl={coverUrl}
              size={COVER_SIZE}
              borderRadius={0}
            />
          </View>
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
              style={[styles.artistName, { color: heroColors.subtle }]}
            >
              {artistName}
            </Text>
          </Pressable>
          <Text variant="caption" style={{ color: heroColors.subtle }}>
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

        <PlayRow
          title={title}
          disabled={albumTracks.length === 0}
          onPlay={() => void playAlbum(albumTracks, playContext)}
          onShuffle={() => void shuffleAlbum(albumTracks, playContext)}
        >
          {/* Shows while the album loads, so the heart doesn't pop in. The
              spacer keeps Play centered when the album can't be favorited. */}
          {albumLoading || album?.identityKey ? (
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
        </PlayRow>

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

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 8,
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: COVER_RADIUS,
    overflow: "hidden",
    boxShadow: ARTWORK_SHADOW,
  },
  albumName: {
    textAlign: "center",
    marginTop: 8,
  },
  artistName: {
    textAlign: "center",
    ...Fonts.medium,
  },
  circleSpacer: {
    width: PLAY_ROW_HEIGHT,
  },
  loader: {
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 32,
  },
});
