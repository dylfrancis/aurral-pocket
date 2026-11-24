import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
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
import { useHeaderHeight, useIsFocused } from "expo-router/react-navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Burnt from "burnt";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import PlaylistPlay from "@expo/material-symbols/playlist_play.xml";
import QueueMusic from "@expo/material-symbols/queue_music.xml";
import Sensors from "@expo/material-symbols/sensors.xml";
import SearchIcon from "@expo/material-symbols/search.xml";
import OpenInNew from "@expo/material-symbols/open_in_new.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import AlbumIcon from "@expo/material-symbols/album.xml";

import { ScrollHeaderTitle } from "@/components/artist/ArtistDetailLayout";
import { CoverTintBackdrop } from "@/components/player/CoverTintBackdrop";
import { pluginMenuSection } from "@/components/plugins/PluginMenuActions";
import {
  ARTWORK_SHADOW,
  PlayerColors,
} from "@/components/player/player-colors";
import { CircleButton } from "@/components/ui/CircleButton";
import { PLAY_ROW_HEIGHT, PlayRow } from "@/components/ui/PlayRow";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Text } from "@/components/ui/Text";
import { AlbumStatusBadge } from "./AlbumStatusBadge";
import { CoverArtImage } from "./CoverArtImage";
import { DiscHeading } from "./DiscHeading";
import { EditionClipRow } from "./EditionClipRow";
import { TrackActionsSheet, useTrackActions } from "./TrackActionsSheet";
import { TrackRow } from "./TrackRow";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import {
  invalidateEditionReads,
  useAlbumEditions,
} from "@/hooks/library/use-album-editions";
import { stopPreviewClip } from "@/hooks/library/use-audio-preview";
import {
  invalidateArtistAlbums,
  useDeleteAlbum,
  useResearchAlbum,
} from "@/hooks/library/use-album-actions";
import {
  useEditionTracks,
  useReleaseGroupTracks,
} from "@/hooks/library/use-edition-tracks";
import { useCoverArtUrl } from "@/hooks/library/use-cover-art-url";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { useLibraryAlbum } from "@/hooks/library/use-library-albums";
import { useToggleFavorite } from "@/hooks/library/use-library-favorites";
import { useLibraryTracks } from "@/hooks/library/use-library-tracks";
import { useSaveOffline } from "@/hooks/offline/use-save-offline";
import { usePlayTrack } from "@/hooks/library/use-play-track";
import { useQueueActions } from "@/hooks/library/use-queue-actions";
import { useCoverTint } from "@/hooks/player/use-cover-color";
import { usePluginActions } from "@/hooks/plugins/use-plugin-actions";
import { useStartRadio } from "@/hooks/player/use-start-radio";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { discHeadings, discOf, discTitles } from "@/lib/album-discs";
import { formatAlbumTrackCount } from "@/lib/album-status";
import { formatBytes, saveStatusLine } from "@/lib/offline/format";
import { useIsOffline } from "@/lib/offline/network";
import { canPlayNow, saveAlbum } from "@/lib/offline/saved-library";
import { setAlbumEdition } from "@/lib/api/library";
import { ApiError } from "@/lib/api/client";
import { formatTrackCount } from "@/lib/discover/format";
import {
  editionLabel,
  editionRows,
  editionSubtitle,
  libraryAlbumRows,
  type AlbumRow,
} from "@/lib/editions";
import { albumDownloadStatus } from "@/lib/library-read";
import { invalidateLibraryLists } from "@/hooks/library/library-lists";
import { libraryKeys } from "@/lib/query-keys";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import { Colors, Fonts } from "@/constants/theme";
import { IS_ANDROID, IS_IOS } from "@/constants/platform";
import { checkableMenuItem } from "@/components/ui/MenuOptions";
import type { DownloadStatusValue, Track } from "@/lib/types/library";
import { releaseYear } from "@/lib/date-time";
import { useOpenArtist } from "@/hooks/use-open-artist";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COVER_SIZE = Math.min(SCREEN_WIDTH - 120, 260);
const COVER_RADIUS = 12;
/** Covers the iOS header above the hero, and the room a pull-down opens. */
const TINT_BLEED = Dimensions.get("window").height;
/** The play row sits below the fade, on the plain background the brand green is made for. */
const HERO_FADE_STOPS = [0.35, 1] as const;

type AlbumRouteParams = {
  ref: string;
  downloadStatus?: string;
  albumMbid?: string;
  libraryAlbumId?: string;
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
  const startRadio = useStartRadio();
  const pluginActions = usePluginActions(
    "album",
    album ? { albumId: album.id } : null,
  );

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

  const year = releaseYear(album?.releaseDate);
  const albumArtist = {
    id: params.artistId || album?.artistId,
    mbid: artistMbid || undefined,
    name: artistName,
  };
  const research = useResearchAlbum({
    albumRef: params.ref,
    album,
    artist: albumArtist,
    downloadStatus,
  });
  const invalidateArtistAlbumList = () =>
    invalidateArtistAlbums(queryClient, albumArtist);

  // The album leaves the Library with its last song. Judged by the list read
  // after the delete, and only while this page shows, so no other page pops.
  const [songDeleted, setSongDeleted] = useState(false);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (songDeleted && isFocused && tracks?.length === 0) router.back();
  }, [songDeleted, isFocused, tracks, router]);

  const deleteAlbum = useDeleteAlbum({
    album,
    title,
    artist: albumArtist,
    // The album this page is about is gone, so the page cannot stay.
    onDeleted: () => router.back(),
  });

  const handleLastFm = useCallback(() => {
    if (!artistName || !title) return;
    void Linking.openURL(
      `https://www.last.fm/music/${encodeURIComponent(artistName)}/${encodeURIComponent(title)}`,
    );
  }, [artistName, title]);

  const openArtistPage = useOpenArtist();
  // An artist with no MBID opens by its Library id.
  const artistRef = artistMbid || params.artistId || album?.artistId || "";
  const openArtist = useCallback(
    () => openArtistPage({ mbid: artistRef, name: artistName }),
    [openArtistPage, artistRef, artistName],
  );

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y + restingOffset;
    },
  });

  // The Library can number a track by another edition, so tracks take their
  // places, and discs their names, from the Library's own edition. The server
  // picks it when no release is asked for.
  const libraryEdition = useReleaseGroupTracks(albumMbid || undefined);
  const libraryEditionTracks = libraryEdition.data;
  // The list waits for the places, so it doesn't reorder under a tap. A read
  // that fails doesn't hold it up through its retries.
  const placesPending =
    libraryEdition.isLoading && libraryEdition.failureCount === 0;
  const placedRows = useMemo(
    () =>
      tracks && !placesPending
        ? libraryAlbumRows(tracks, libraryEditionTracks ?? [])
        : undefined,
    [tracks, placesPending, libraryEditionTracks],
  );
  const placedTracks = useMemo(
    () => placedRows?.flatMap((row) => (row.track ? [row.track] : [])),
    [placedRows],
  );
  // A track the Library lacks offers its clip, so clips load only then.
  const hasMissingRows = !!placedRows?.some((row) => row.missing);
  const { tracks: libraryEditionClips } = useEditionTracks(
    albumMbid || undefined,
    { artistMbid: artistMbid || undefined, enabled: hasMissingRows },
  );
  const clipTrackByRecording = useMemo(
    () =>
      new Map((libraryEditionClips ?? []).map((track) => [track.id, track])),
    [libraryEditionClips],
  );
  // The album's popular recordings, which every copy of them shares.
  const popularRecordings = useMemo(
    () =>
      new Set(
        (libraryEditionTracks ?? []).flatMap((track) =>
          track.popular ? [track.id] : [],
        ),
      ),
    [libraryEditionTracks],
  );

  // Re-renders the rows' unavailable state as the connection comes and goes.
  useIsOffline();
  const saveOffline = useSaveOffline({
    kind: "album",
    id: params.ref,
    title,
    save:
      placedTracks && placedTracks.some((track) => track.streamPath)
        ? () =>
            saveAlbum({
              ref: params.ref,
              route: {
                title,
                artistName,
                artistMbid,
                albumMbid,
                coverUrl: coverUrl ?? "",
                libraryAlbumId: params.libraryAlbumId ?? "",
                artistId: params.artistId || album?.artistId || "",
              },
              tracks: placedTracks,
              album: album ?? undefined,
            })
        : null,
  });
  // A saved album still lists and plays its tracks with no connection.
  const savedItem = saveOffline.status?.item;
  const savedTracks = savedItem?.kind === "album" ? savedItem.tracks : null;
  const albumTracks = useMemo(
    () => placedTracks ?? savedTracks ?? [],
    [placedTracks, savedTracks],
  );
  const albumRows = useMemo<AlbumRow[]>(
    () =>
      placedRows ??
      (savedTracks ?? []).map((track) => ({ key: track.id, track })),
    [placedRows, savedTracks],
  );
  const showTracksLoading = (tracksLoading || placesPending) && !savedTracks;
  // Before saving, the files' size on the server.
  const albumBytes = albumTracks
    .filter((track) => track.streamPath)
    .reduce((sum, track) => sum + (track.size > 0 ? track.size : 0), 0);
  const saveLine = saveStatusLine(saveOffline.status);
  // Aurral drops a deleted song from the album's count, so the rows the page
  // lists count too, as on the web: a delete reads 11/12, not 11/11.
  const shownTrackCount = Math.max(
    albumRows.length,
    album?.statistics.trackCount ?? 0,
  );
  const fileCount = Math.max(
    albumTracks.filter((track) => track.streamPath).length,
    album?.statistics.trackFileCount ?? 0,
  );
  const complete = shownTrackCount > 0 && fileCount >= shownTrackCount;

  const editions = useAlbumEditions(albumMbid || undefined, {
    inLibrary: true,
  });
  const previewRelease = editions.previewRelease;
  const {
    tracks: editionTracks,
    isLoading: editionTracksLoading,
    isError: editionTracksFailed,
  } = useEditionTracks(albumMbid || undefined, {
    release: previewRelease,
    artistMbid: artistMbid || undefined,
    enabled: !!previewRelease,
  });
  const preview = useMemo(
    () =>
      previewRelease && editionTracks
        ? editionRows(editionTracks, albumTracks)
        : null,
    [previewRelease, editionTracks, albumTracks],
  );
  const previewHeadings = useMemo(
    () =>
      discHeadings(
        (preview?.rows ?? []).map((row) => ({
          disc: discOf(row.editionTrack),
          tagTitle: row.libraryTrack?.discTitle,
          musicBrainzTitle: row.editionTrack.discTitle,
        })),
      ),
    [preview],
  );

  const albumHeadings = useMemo(() => {
    const musicBrainzTitles = discTitles(
      (libraryEditionTracks ?? []).map((track) => ({
        disc: discOf(track),
        title: track.discTitle,
      })),
    );
    return discHeadings(
      albumRows.map((row) => {
        const disc = discOf(row.track ?? row.missing);
        return {
          disc,
          tagTitle: row.track?.discTitle,
          musicBrainzTitle: musicBrainzTitles.get(disc),
        };
      }),
    );
  }, [albumRows, libraryEditionTracks]);

  // Play follows the list as shown, so nothing plays until the edition's list
  // is in.
  const listTracks = useMemo<Track[]>(() => {
    if (!previewRelease) return albumTracks;
    if (!preview) return [];
    return [
      ...preview.rows.flatMap((row) =>
        row.libraryTrack?.streamPath ? [row.libraryTrack] : [],
      ),
      ...preview.extras,
    ];
  }, [previewRelease, preview, albumTracks]);

  // Leaving the page must not leave a clip playing behind it.
  useEffect(() => () => stopPreviewClip(), []);

  const canSwitchEdition = !!album && hasPermission("addAlbum");
  const switchEdition = useMutation({
    mutationFn: async (releaseMbid: string) => {
      if (album) await setAlbumEdition(album.id, releaseMbid);
    },
    onSuccess: async (_data, releaseMbid) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Awaited, so the preview ends on the new edition's tracks, not the old
      // ones.
      await Promise.all([
        invalidateEditionReads(queryClient, albumMbid),
        queryClient.invalidateQueries({
          queryKey: libraryKeys.tracks(params.ref),
        }),
        queryClient.invalidateQueries({
          queryKey: libraryKeys.album(params.ref),
        }),
      ]);
      // An edition picked while the switch was saving stays picked.
      editions.view((picked) => (picked === releaseMbid ? null : picked));
      invalidateArtistAlbumList();
      invalidateLibraryLists(queryClient);
    },
    onError: (error) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Burnt.toast({
        title: "Couldn't change the edition",
        message: error instanceof ApiError ? error.message : undefined,
        preset: "error",
      });
    },
  });

  /**
   * A Library track's row. `number` and `popular` come from a previewed
   * edition, which flags its own popular tracks.
   */
  const renderTrack = (
    track: Track,
    number?: number,
    popular = !!track.mbid && popularRecordings.has(track.mbid),
  ) => (
    <TrackRow
      key={track.id}
      track={number === undefined ? track : { ...track, trackNumber: number }}
      // A track with no credit of its own is the album artist's.
      artist={track.artistName || artistName}
      popular={popular}
      unavailable={!canPlayNow(track.id)}
      // A saved album's toolbar already says its tracks are on the phone.
      markSaved={saveOffline.status?.state !== "saved"}
      onPress={() => void play(listTracks, track, playContext)}
      onLongPress={() => trackActions.open(track, playContext)}
      onMenuPress={() => trackActions.open(track, playContext)}
    />
  );

  // As on the web, only a Library album shows how many have files, in amber
  // while songs are missing.
  const trackCountText = formatAlbumTrackCount(
    shownTrackCount,
    album ? fileCount : undefined,
  );
  const heroMeta: ReactNode[] = (
    previewRelease && editions.viewing
      ? [
          releaseYear(editions.viewing.date),
          formatTrackCount(editions.viewing.trackCount),
        ]
      : [
          year,
          shownTrackCount > 0 && album && !complete ? (
            <Text
              key="tracks"
              variant="caption"
              style={{ color: heroColors.warning }}
            >
              {trackCountText}
            </Text>
          ) : shownTrackCount > 0 ? (
            trackCountText
          ) : null,
          albumBytes > 0 ? formatBytes(albumBytes) : null,
        ]
  ).filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollHeaderTitle name={title} scrollY={scrollY} />
      {IS_ANDROID && (
        // The opaque header carries the tint, so it meets the hero's without
        // a seam. iOS draws the hero's own tint under its header.
        <Stack.Screen options={{ headerStyle: { backgroundColor: tint } }} />
      )}
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
            icon={IS_IOS ? "dot.radiowaves.left.and.right" : Sensors}
            // Seeded by the Library album, so it waits for the record.
            hidden={!album}
            onPress={() => {
              if (!album) return;
              void startRadio({ seed: { albumIds: [album.id] }, label: title });
            }}
          >
            Start Radio
          </Stack.Toolbar.MenuAction>
          {editions.visible && editions.viewing ? (
            // Picking only previews an edition. The note under the hero
            // carries Use This Edition, which is what switches it.
            <Stack.Toolbar.Menu
              icon={IS_IOS ? "square.stack" : AlbumIcon}
              title="Edition"
            >
              {editions.editions.map((edition) => {
                const detail = editionSubtitle(edition, editions.library);
                return (
                  <Stack.Toolbar.MenuAction
                    key={edition.id}
                    {...checkableMenuItem(edition.id === editions.viewing?.id)}
                    // Android menus drop subtitles, and names repeat, so the
                    // year and length go in the title there.
                    subtitle={IS_IOS ? detail : undefined}
                    onPress={() => {
                      stopPreviewClip();
                      editions.view(edition.id);
                    }}
                  >
                    {IS_IOS ? edition.name : `${edition.name} · ${detail}`}
                  </Stack.Toolbar.MenuAction>
                );
              })}
            </Stack.Toolbar.Menu>
          ) : null}
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "magnifyingglass" : SearchIcon}
            hidden={!research.visible}
            disabled={research.isPending}
            onPress={research.research}
          >
            {research.isPending ? "Searching…" : research.label}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "arrow.up.right.square" : OpenInNew}
            hidden={!artistName || !title}
            onPress={handleLastFm}
          >
            View on Last.fm
          </Stack.Toolbar.MenuAction>
          {pluginMenuSection(pluginActions)}
          <Stack.Toolbar.MenuAction
            icon={IS_IOS ? "trash" : DeleteIcon}
            // Native menus only offer the platform destructive style, so this
            // red is the system red rather than the theme's error token.
            destructive
            hidden={!deleteAlbum.canDelete}
            disabled={deleteAlbum.isPending}
            onPress={deleteAlbum.confirmDelete}
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
            disabled={!artistRef}
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
            {heroMeta.flatMap((part, index) =>
              index > 0 ? [" · ", part] : [part],
            )}
          </Text>
          {saveLine ? (
            <Text variant="caption" style={{ color: heroColors.subtle }}>
              {saveLine}
            </Text>
          ) : null}
          {previewRelease && editions.libraryEdition ? (
            <View style={styles.editionNote}>
              <Text
                variant="caption"
                style={[styles.centered, { color: heroColors.subtle }]}
              >
                Your Library has the{" "}
                {editionLabel(editions.libraryEdition.name)}.
              </Text>
              {canSwitchEdition ? (
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Medium,
                    );
                    switchEdition.mutate(previewRelease);
                  }}
                  disabled={switchEdition.isPending}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.editionAction,
                    {
                      borderColor: heroColors.faint,
                      opacity: pressed || switchEdition.isPending ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={[
                      styles.editionActionLabel,
                      { color: heroColors.text },
                    ]}
                  >
                    {switchEdition.isPending
                      ? "Switching…"
                      : "Use This Edition"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {album && (
            <AlbumStatusBadge
              album={album}
              complete={complete}
              downloadStatus={downloadStatus}
            />
          )}
        </View>

        <PlayRow
          title={title}
          disabled={listTracks.length === 0}
          onPlay={() => void playAlbum(listTracks, playContext)}
          onShuffle={() => void shuffleAlbum(listTracks, playContext)}
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

        {showTracksLoading || (previewRelease && editionTracksLoading) ? (
          <ActivityIndicator style={styles.loader} color={colors.brand} />
        ) : previewRelease && editionTracksFailed ? (
          <Text variant="caption" style={styles.emptyText}>
            Couldn&apos;t load this edition&apos;s tracks
          </Text>
        ) : preview ? (
          <>
            {preview.rows.map((row, index) => (
              <Fragment key={row.key}>
                <DiscHeading
                  title={previewHeadings[index]}
                  first={index === 0}
                />
                {row.libraryTrack?.streamPath ? (
                  renderTrack(
                    row.libraryTrack,
                    row.editionTrack.trackNumber,
                    row.editionTrack.popular,
                  )
                ) : (
                  <EditionClipRow
                    track={row.editionTrack}
                    artistName={artistName}
                    albumTitle={title}
                    artwork={artworkUrl}
                  />
                )}
              </Fragment>
            ))}
            {preview.extras.length > 0 ? (
              <SectionLabel style={styles.extrasLabel}>
                From Other Editions
              </SectionLabel>
            ) : null}
            {preview.extras.map((track) => renderTrack(track))}
          </>
        ) : albumRows.length > 0 ? (
          albumRows.map((row, index) => (
            <Fragment key={row.key}>
              <DiscHeading title={albumHeadings[index]} first={index === 0} />
              {row.track ? (
                renderTrack(row.track)
              ) : (
                <EditionClipRow
                  track={
                    clipTrackByRecording.get(row.missing.id) ?? row.missing
                  }
                  artistName={artistName}
                  albumTitle={title}
                  artwork={artworkUrl}
                />
              )}
            </Fragment>
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
        onDeleted={() => setSongDeleted(true)}
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
  centered: {
    textAlign: "center",
  },
  editionNote: {
    alignItems: "center",
    gap: 8,
  },
  editionAction: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editionActionLabel: {
    ...Fonts.semiBold,
  },
  extrasLabel: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
});
