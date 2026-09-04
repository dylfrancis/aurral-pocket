import { useCallback, useRef, useState } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetView, type BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import PlaylistPlay from "@expo/material-symbols/playlist_play.xml";
import QueueMusic from "@expo/material-symbols/queue_music.xml";
import SearchIcon from "@expo/material-symbols/search.xml";
import OpenInNew from "@expo/material-symbols/open_in_new.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";

import { ScrollHeaderTitle } from "@/components/artist/ArtistDetailLayout";
import {
  AddToPlaylistSheet,
  useAddToPlaylist,
} from "@/components/flow/AddToPlaylistSheet";
import { AppSheet } from "@/components/ui/AppSheet";
import { Text } from "@/components/ui/Text";
import { AlbumStatusBadge } from "./AlbumStatusBadge";
import { CoverArtImage } from "./CoverArtImage";
import { TrackRow } from "./TrackRow";
import { useCoverArtUrl } from "@/hooks/library/use-cover-art-url";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { useLibraryAlbum } from "@/hooks/library/use-library-albums";
import { useLibraryTracks } from "@/hooks/library/use-library-tracks";
import { usePlayTrack } from "@/hooks/library/use-play-track";
import { useQueueActions } from "@/hooks/library/use-queue-actions";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { deleteAlbum, triggerAlbumSearch } from "@/lib/api/library";
import { libraryAlbumsRef } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import { Colors, Fonts } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import type { Track } from "@/lib/types/library";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COVER_SIZE = Math.min(SCREEN_WIDTH - 120, 260);

type AlbumRouteParams = {
  ref: string;
  albumId?: string;
  albumMbid?: string;
  canonicalAlbumId?: string;
  title?: string;
  artistName?: string;
  artistMbid?: string;
  artistId?: string;
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<AlbumRouteParams>();

  const { data: album } = useLibraryAlbum(params.ref);
  const { data: tracks, isLoading: tracksLoading } = useLibraryTracks(
    params.ref,
  );
  // One album, so the polled id set stays small.
  const { data: downloadStatuses } = useDownloadStatuses(
    album ? [album] : undefined,
  );
  const downloadStatus = album
    ? downloadStatuses?.[album.id]?.status
    : undefined;

  const albumMbid = params.albumMbid || album?.mbid || "";
  const title = album?.albumName || params.title || "";
  const artistName = params.artistName || album?.artistName || "";
  // Lidarr owns delete and re-search, so both need its id. A page opened
  // without one — a file-scanned album — hides those two actions.
  const lidarrAlbumId = params.albumId || "";

  // Resolved from the cache the hero cover fills, so the player carries the
  // artwork onto the mini player and the lock screen.
  const { url: artworkUrl } = useCoverArtUrl({
    type: "album",
    mbid: albumMbid || undefined,
  });

  const playContext: PlayerAlbumContext = {
    albumTitle: title,
    artistName,
    artworkUrl,
    albumMbid: albumMbid || null,
    artistMbid: params.artistMbid || null,
  };

  const play = usePlayTrack();
  const { playNext, addToQueue, playAlbum, shuffleAlbum } = useQueueActions();

  const { canAddToPlaylist, ...addToPlaylist } = useAddToPlaylist();
  // A SharedPlaylistTrack needs an artist name, so the permission alone is
  // not enough to offer the action.
  const canAddTracks = canAddToPlaylist && !!artistName;

  const trackActionsRef = useRef<BottomSheetModal>(null);
  const [actionTrack, setActionTrack] = useState<Track | null>(null);

  const openTrackActions = useCallback((track: Track) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionTrack(track);
    trackActionsRef.current?.present();
  }, []);

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
    onSuccess: () => {
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
        <View style={styles.hero}>
          <CoverArtImage
            type="album"
            mbid={albumMbid}
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
            {[year, trackCount ? `${trackCount} tracks` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {album && (
            <AlbumStatusBadge album={album} downloadStatus={downloadStatus} />
          )}
        </View>

        <View style={styles.playRow}>
          <PlayButton
            icon="play"
            label="Play"
            onPress={() => void playAlbum(albumTracks, playContext)}
            disabled={albumTracks.length === 0}
          />
          <PlayButton
            icon="shuffle"
            label="Shuffle"
            onPress={() => void shuffleAlbum(albumTracks, playContext)}
            disabled={albumTracks.length === 0}
          />
        </View>

        {tracksLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.brand} />
        ) : albumTracks.length > 0 ? (
          albumTracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onPress={() => void play(albumTracks, track, playContext)}
              onLongPress={() => openTrackActions(track)}
            />
          ))
        ) : (
          <Text variant="caption" style={styles.emptyText}>
            No tracks available
          </Text>
        )}
      </Animated.ScrollView>

      <AppSheet
        ref={trackActionsRef}
        enableDynamicSizing
        enablePanDownToClose
        onDismiss={() => setActionTrack(null)}
      >
        <BottomSheetView
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        >
          <Text variant="subtitle" numberOfLines={1} style={styles.sheetTitle}>
            {actionTrack?.trackName}
          </Text>
          <SheetAction
            icon="play-forward-outline"
            label="Play Next"
            onPress={() => {
              const track = actionTrack;
              trackActionsRef.current?.dismiss();
              if (track) void playNext([track], playContext);
            }}
          />
          <SheetAction
            icon="list-outline"
            label="Add to Queue"
            onPress={() => {
              const track = actionTrack;
              trackActionsRef.current?.dismiss();
              if (track) void addToQueue([track], playContext);
            }}
          />
          {canAddTracks && (
            <SheetAction
              icon="add-circle-outline"
              label="Add to Playlist"
              onPress={() => {
                const track = actionTrack;
                trackActionsRef.current?.dismiss();
                if (!track) return;
                addToPlaylist.open({
                  artistName,
                  trackName: track.trackName,
                  albumName: title,
                  artistMbid: params.artistMbid || null,
                });
              }}
            />
          )}
        </BottomSheetView>
      </AppSheet>

      <AddToPlaylistSheet
        track={addToPlaylist.track}
        onClose={addToPlaylist.close}
      />
    </View>
  );
}

function PlayButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = Colors[useColorScheme()];
  return (
    <Pressable
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
      <Ionicons name={icon} size={18} color={colors.buttonPrimaryText} />
      <Text
        variant="body"
        style={[styles.playLabel, { color: colors.buttonPrimaryText }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = Colors[useColorScheme()];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sheetRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingTop: IS_IOS ? 8 : 16,
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
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  playButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
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
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 4,
  },
  sheetTitle: {
    paddingBottom: 8,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
});
