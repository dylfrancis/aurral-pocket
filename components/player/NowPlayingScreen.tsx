import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Host } from "@expo/ui";
import { usePreventRemove, useRouter, type Href } from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  LayoutAnimationConfig,
  ReduceMotion,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AddToPlaylistSheet,
  useAddToPlaylist,
} from "@/components/flow/AddToPlaylistSheet";
import { CoverTintBackdrop } from "@/components/player/CoverTintBackdrop";
import { DevicesButton } from "@/components/player/DevicesButton";
import { LyricsView } from "@/components/player/LyricsView";
import {
  type CoverFrame,
  type LayoutNode,
  locateMiniPlayer,
  MINI_COVER_RADIUS,
  miniCoverHidden,
  type Point,
} from "@/components/player/mini-player-cover";
import { OutputButton } from "@/components/player/OutputButton";
import { PlayerArtwork } from "@/components/player/PlayerArtwork";
import {
  ARTWORK_SHADOW,
  PlayerColors,
  usePlayerColors,
} from "@/components/player/player-colors";
import { Scrubber } from "@/components/player/Scrubber";
import { TrackMenu } from "@/components/player/TrackMenu";
import { SettingsSwitch } from "@/components/settings/SettingsSwitch";
import type {
  TrackMenuAction,
  TrackMenuActionId,
} from "@/components/player/track-menu-types";
import { MarqueeText } from "@/components/ui/MarqueeText";
import { Text } from "@/components/ui/Text";
import { IS_ANDROID } from "@/constants/platform";
import { Fonts } from "@/constants/theme";
import { useLyricsOpen } from "@/contexts/now-playing-context";
import {
  jobLibraryRequest,
  useAddTrackToLibrary,
} from "@/hooks/library/use-add-track-to-library";
import {
  useDeletableTrackId,
  useDeleteLibraryTrack,
} from "@/hooks/library/use-delete-library-track";
import {
  useIsFavoriteTrack,
  useToggleFavorite,
} from "@/hooks/library/use-library-favorites";
import { toastNotSaved } from "@/hooks/offline/toast-not-saved";
import { useSongSave } from "@/hooks/offline/use-song-save";
import { useCoverTint } from "@/hooks/player/use-cover-color";
import { useDragToClose } from "@/hooks/player/use-drag-to-close";
import { useLibraryTrackDetails } from "@/hooks/player/use-library-track-details";
import { useLyricsKeepAwake } from "@/hooks/player/use-lyrics-keep-awake";
import { useSwipeToSkip } from "@/hooks/player/use-swipe-to-skip";
import { useTrackLyrics } from "@/hooks/player/use-track-lyrics";
import { usePluginActions } from "@/hooks/plugins/use-plugin-actions";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { TrackFavorite } from "@/lib/api/library";
import { useCanPlayNow } from "@/lib/offline/saved-library";
import {
  next,
  playQueueItem,
  previous,
  setRepeatMode,
  setShuffle,
  togglePlayback,
  useCurrentTrack,
  usePlaybackState,
  usePlayerModes,
  useQueue,
  type RepeatMode,
} from "@/lib/player/player";
import {
  setPlaybackSettings,
  usePlaybackSettings,
} from "@/lib/player/playback-settings";
import { libraryIdsOf, type PlayerTrack } from "@/lib/player/track-item";

/** Each repeat tap steps to the next mode: queue, then track, then off. */
const NEXT_REPEAT_MODE: Record<RepeatMode, RepeatMode> = {
  off: "all",
  all: "one",
  one: "off",
};

const GUTTER = 16;
const ART_RADIUS = 12;
const THUMB_SIZE = 64;
const THUMB_RADIUS = 6;
const ART_MOVE_TIMING = {
  duration: 300,
  easing: Easing.bezier(0.77, 0, 0.175, 1),
  reduceMotion: ReduceMotion.System,
};
const SWAP_FADE = FadeIn.duration(200);
/** The controls sit below the fade, on the plain background the brand green is made for. */
const TINT_FADE_STOPS = [0.3, 0.72] as const;
const PLAY_SIZE = 56;
const SKIP_SIZE = 40;
const PRESS_FEEDBACK_TRANSITION = {
  transitionProperty: ["opacity", "transform"],
  transitionDuration: 120,
  transitionTimingFunction: "ease-out",
};

const QUEUE_HEADING_TEXT = { ...Fonts.semiBold, fontSize: 18 };

/** The queue panel's list: the listener's tracks, then Autoplay's. */
type QueueRow =
  | { kind: "track"; item: PlayerTrack }
  | { kind: "empty" }
  | { kind: "autoplay" };

/**
 * Progress lives in the Scrubber alone; everything else here reads track,
 * state, queue, and modes, so a progress tick re-renders nothing but the
 * scrubber.
 */
export function NowPlayingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  // So the art can travel from and back to the mini player. Reduce Motion
  // keeps the route's fade.
  const animatesItself = !useReducedMotion();
  const track = useCurrentTrack();
  const state = usePlaybackState();
  const modes = usePlayerModes();
  const { items, currentId, album } = useQueue();
  const colors = PlayerColors[useColorScheme()];
  const tint = useCoverTint(track);
  const [showQueue, setShowQueue] = useState(false);
  // Opening the queue turns lyrics off, so the two are never both open.
  const [lyricsOpen, setLyricsOpen] = useLyricsOpen();
  const lyrics = useTrackLyrics(track);
  const details = useLibraryTrackDetails(track);
  // Left on, the lyrics panel gives way to the art for a track without lyrics
  // and comes back for the next one that has them.
  const showLyrics = lyricsOpen && lyrics.available;
  // The queue and the lyrics both shrink the art into the header row.
  const compact = showQueue || showLyrics;
  // Only the full-size art swipes. It leaves by the screen's edge.
  const swipe = useSwipeToSkip(track, { travel: width, enabled: !compact });
  const skipPan = usePanGesture(swipe.panConfig);

  // Once the sheet has gone, the route's removal goes through at once.
  const [hasLeft, setHasLeft] = useState(false);
  const disablePreventionRef = useRef(() => {});
  const markLeft = useCallback(() => {
    setHasLeft(true);
    disablePreventionRef.current();
  }, []);
  const finishDrag = useCallback(() => {
    markLeft();
    router.back();
  }, [markLeft, router]);

  // The tapped mini player, relative to this screen: the art lands on its
  // cover and the sheet shrinks toward its center. Without one, the sheet
  // slides and the art rides it.
  const rootRef = useRef<LayoutNode>(null);
  const miniCover = useSharedValue<CoverFrame | null>(null);
  const miniCenter = useSharedValue<Point | null>(null);
  useLayoutEffect(() => {
    if (!animatesItself) return;
    const miniPlayer = locateMiniPlayer(rootRef.current);
    miniCover.set(miniPlayer?.cover ?? null);
    miniCenter.set(miniPlayer?.center ?? null);
  }, [animatesItself, miniCenter, miniCover]);

  const drag = useDragToClose(finishDrag, {
    startBelow: animatesItself,
    collapseTo: miniCenter,
  });
  const { enter: enterSheet, leave: leaveSheet } = drag;
  // Two drag areas, so the list between them can scroll.
  const topPan = usePanGesture(drag.panConfig);
  const controlsPan = usePanGesture(drag.panConfig);
  const art = useArtFrame(swipe.offset, drag, miniCover, width - GUTTER * 2);

  // The art has to be placed, in its slot or the header, before it can
  // grow there.
  const entered = useRef(!animatesItself);
  const canEnter = art.size > 0 || !track;
  useEffect(() => {
    if (entered.current || !canEnter) return;
    entered.current = true;
    enterSheet();
  }, [canEnter, enterSheet]);

  // From lift-off to landing, so the mini player shows one cover.
  useAnimatedReaction(
    () => drag.dismissal.get(),
    (progress, previous) => {
      if (!miniCover.get()) return;
      miniCoverHidden.set(
        previous !== null && progress > previous && progress < 1,
      );
    },
  );
  useEffect(() => () => miniCoverHidden.set(false), []);

  const leave = useCallback(
    (navigate: () => void) => {
      const done = () => {
        markLeft();
        navigate();
      };
      if (animatesItself) leaveSheet(done);
      else done();
    },
    [animatesItself, leaveSheet, markLeft],
  );
  const close = useCallback(() => leave(() => router.back()), [leave, router]);
  // Android's Back, and any other removal, waits for the sheet to go.
  const disablePrevention = usePreventRemove(
    animatesItself && !hasLeft,
    ({ repeat }) => leave(repeat),
  );
  useEffect(() => {
    disablePreventionRef.current = disablePrevention;
  }, [disablePrevention]);

  const isPlaying = state === "playing" || state === "buffering";
  useLyricsKeepAwake(!!track && showLyrics, isPlaying);
  // A missing match means the engine is on an item the facade did not
  // queue; an empty list beats presenting the whole queue as "up next".
  const currentIndex = items.findIndex((it) => it.id === currentId);
  const queueRows = useMemo(() => {
    const upNext = currentIndex < 0 ? [] : items.slice(currentIndex + 1);
    const queued = upNext.filter((item) => !item.autoplay);
    const autoplayed = upNext.filter((item) => item.autoplay);
    const row = (item: PlayerTrack): QueueRow => ({ kind: "track", item });
    return [
      ...(queued.length > 0 ? queued.map(row) : [{ kind: "empty" } as const]),
      { kind: "autoplay" } as const,
      ...autoplayed.map(row),
    ];
  }, [items, currentIndex]);
  // A playlist's tracks each have their own artist, and its context has none.
  const artistMbid = track?.artistMbid ?? album?.artistMbid ?? null;

  // The player sits over the tabs, so it must go before a page can show. The
  // paths name the library group — a bare /artist/[mbid] resolves into
  // (activity), the first group with the route. navigate, not push: repeated
  // taps must not stack duplicate pages. On Android, Settings can
  // sit between the player and the tabs, so it pops back down to the tabs.
  const leaveFor = useCallback(
    (href: Href) =>
      leave(() => {
        if (IS_ANDROID) {
          router.dismissTo(href);
          return;
        }
        router.back();
        router.navigate(href);
      }),
    [leave, router],
  );

  const openArtist = useCallback(() => {
    if (!artistMbid) return;
    leaveFor({
      pathname: "/(app)/(tabs)/(library)/artist/[mbid]",
      // An artist outside the library opens the Browse page, which takes its
      // title from the route.
      params: { mbid: artistMbid, name: track?.artist ?? "" },
    });
  }, [artistMbid, track?.artist, leaveFor]);

  // Only tracks with an album page: a playlist download has none.
  const openAlbum = useCallback(() => {
    if (!track?.albumRef) return;
    leaveFor({
      pathname: "/(app)/(tabs)/(library)/album/[ref]",
      params: {
        ref: track.albumRef,
        title: track.album,
        artistName: track.artist,
        artistMbid: artistMbid ?? "",
        albumMbid: track.albumMbid ?? "",
        coverUrl: track.coverPath ?? "",
      },
    });
  }, [track, artistMbid, leaveFor]);

  const addToPlaylist = useAddToPlaylist();
  const addToLibrary = useAddTrackToLibrary();
  const libraryTrackId = libraryIdsOf(
    track?.streamPath ?? null,
  )?.libraryTrackId;
  const loadedJob =
    track && !libraryTrackId ? addToLibrary.loadedJob(track.id) : undefined;
  const menuActions: TrackMenuAction[] = [];
  // Any track not played from the Library, such as a flow's. Aurral says so
  // when it already has the song.
  if (
    track &&
    addToLibrary.canAdd &&
    !libraryTrackId &&
    !loadedJob?.libraryOwned &&
    track.artist
  ) {
    menuActions.push({
      id: "library",
      title: "Add to Library",
      disabled: addToLibrary.isSending(track.id),
    });
  }
  // A playlist track needs an artist name, so the permission alone is not
  // enough to offer the action.
  if (track && addToPlaylist.canAddToPlaylist && track.artist) {
    menuActions.push({ id: "playlist", title: "Add to Playlist" });
  }
  if (track?.albumRef) {
    menuActions.push({ id: "album", title: "Go to Album" });
  }
  if (artistMbid) {
    menuActions.push({ id: "artist", title: "Go to Artist" });
  }
  const songSave = useSongSave();
  const saveAction = songSave.actionFor(track);
  if (saveAction) menuActions.push(saveAction);
  const pluginActions = usePluginActions(
    "track",
    libraryTrackId ? { trackIds: [libraryTrackId] } : null,
  );
  const deleteTrack = useDeleteLibraryTrack();
  const deletableId = useDeletableTrackId(null, track, deleteTrack.canDelete);
  const trailingActions: TrackMenuAction[] = deletableId
    ? [
        {
          id: "delete",
          title: "Delete from Library",
          destructive: true,
          disabled: deleteTrack.isDeleting(deletableId),
        },
      ]
    : [];

  const onMenuAction = (id: TrackMenuActionId) => {
    if (!track) return;
    if (songSave.run(id, track)) return;
    if (id === "delete") {
      if (deletableId) deleteTrack.confirmDelete(deletableId, track.title);
    } else if (id === "library") {
      addToLibrary.add(
        track.id,
        loadedJob
          ? jobLibraryRequest(loadedJob)
          : {
              artistName: track.artist,
              trackName: track.title,
              albumName: track.album || null,
              artistMbid,
              albumMbid: track.albumMbid,
              trackMbid: track.trackMbid,
            },
      );
    } else if (id === "playlist") {
      addToPlaylist.open({
        artistName: track.artist,
        trackName: track.title,
        albumName: track.album || null,
        artistMbid,
        albumMbid: track.albumMbid,
        trackMbid: track.trackMbid,
      });
    } else if (id === "album") {
      openAlbum();
    } else if (id === "artist") {
      openArtist();
    }
  };

  const renderQueueRow = useCallback(({ item: row }: { item: QueueRow }) => {
    if (row.kind === "track") return <UpNextRow item={row.item} />;
    if (row.kind === "autoplay") return <AutoplayHeading />;
    return <QueueEmptyRow />;
  }, []);

  const fileQuality = track
    ? describeFileQuality(track.audioFormat, details.bitrateKbps)
    : null;

  const favorite =
    track && details.favorite ? (
      <FavoriteButton
        // Remounts per track, so a toggle still in flight doesn't show on the
        // next one.
        key={`${details.favorite.kind}:${details.favorite.key}`}
        favorite={details.favorite}
        trackMbid={track.trackMbid}
        trackTitle={track.title}
      />
    ) : null;

  return (
    // A native modal sits outside the app root's gesture host, so the player
    // brings its own.
    <GestureHandlerRootView style={styles.screen}>
      <View ref={rootRef} collapsable={false} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, drag.backdropStyle]}
      />
      <Animated.View
        style={[styles.sheet, drag.sheetStyle]}
        onAccessibilityEscape={close}
      >
        <CoverTintBackdrop tint={tint} fadeStops={TINT_FADE_STOPS} />
        <LayoutAnimationConfig skipEntering>
          <GestureDetector gesture={topPan}>
            <View
              style={[
                styles.top,
                (!track || !compact) && styles.topFill,
                { paddingTop: insets.top },
              ]}
            >
              <Grabber onPress={close} />
              {!track ? (
                <View style={styles.empty}>
                  <Text variant="subtitle" style={{ color: colors.text }}>
                    Nothing is playing.
                  </Text>
                </View>
              ) : compact ? (
                <Animated.View
                  entering={SWAP_FADE}
                  style={styles.thumbRow}
                  onLayout={art.onThumbRowLayout}
                >
                  <View style={styles.thumbPlaceholder} />
                  <TrackTitles
                    track={track}
                    align="start"
                    onTitlePress={track.albumRef ? openAlbum : undefined}
                    onArtistPress={artistMbid ? openArtist : undefined}
                  />
                </Animated.View>
              ) : (
                <>
                  {/* Siblings, not a wrapper: the art is placed from the
                      slot's frame in the top area. */}
                  <View style={styles.artSpacer} />
                  <View
                    style={[styles.artSlot, { height: width - GUTTER * 2 }]}
                    onLayout={art.onArtSlotLayout}
                  >
                    {/* Inside the slot: a detector around it shifts the
                        frame the slot measures, and the art is placed by it. */}
                    <GestureDetector gesture={skipPan}>
                      <View style={StyleSheet.absoluteFill} />
                    </GestureDetector>
                  </View>
                  <Animated.View entering={SWAP_FADE} style={styles.titleRow}>
                    <TrackTitles
                      track={track}
                      align="center"
                      onTitlePress={track.albumRef ? openAlbum : undefined}
                      onArtistPress={artistMbid ? openArtist : undefined}
                    />
                  </Animated.View>
                  <View style={styles.artSpacer} />
                </>
              )}
            </View>
          </GestureDetector>

          {track && showQueue && (
            <Animated.View entering={SWAP_FADE} style={styles.queue}>
              <Text
                variant="subtitle"
                style={[styles.queueHeading, { color: colors.text }]}
              >
                Up Next
              </Text>
              {/* A core FlatList, not FlashList: FlashList v2 sizes itself
                  against a container still settling and leaves a gap above
                  the first row until the first scroll. */}
              <FlatList
                data={queueRows}
                renderItem={renderQueueRow}
                keyExtractor={queueRowKey}
                style={styles.queueList}
                contentContainerStyle={styles.queueContent}
              />
            </Animated.View>
          )}

          {track && showLyrics && (
            <Animated.View entering={SWAP_FADE} style={styles.lyrics}>
              <LyricsView
                // Each track measures and scrolls its own lines.
                key={track.id}
                trackId={track.id}
                lyrics={lyrics.lyrics}
              />
            </Animated.View>
          )}

          {track && (
            <GestureDetector gesture={controlsPan}>
              <View
                style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}
              >
                <View style={styles.actionRow}>
                  <View style={[styles.actionSlot, styles.actionSlotStart]}>
                    {favorite}
                  </View>
                  <Text
                    variant="caption"
                    numberOfLines={1}
                    style={[styles.fileQuality, { color: colors.subtle }]}
                    accessibilityLabel={fileQuality?.spoken}
                  >
                    {fileQuality?.shown}
                  </Text>
                  <View style={[styles.actionSlot, styles.actionSlotEnd]}>
                    {menuActions.length +
                      pluginActions.length +
                      trailingActions.length >
                      0 && (
                      <TrackMenu
                        actions={menuActions}
                        onAction={onMenuAction}
                        pluginActions={pluginActions}
                        trailingActions={trailingActions}
                        triggerColor={colors.text}
                      />
                    )}
                  </View>
                </View>
                <Scrubber />
                <View style={styles.transport}>
                  <Pressable
                    onPress={() => setShuffle(!modes.shuffle)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: modes.shuffle }}
                    accessibilityLabel="Shuffle"
                    style={styles.modeButton}
                  >
                    <Ionicons
                      name="shuffle"
                      size={28}
                      color={modes.shuffle ? colors.brand : colors.subtle}
                    />
                    {modes.shuffle && (
                      <View
                        style={[
                          styles.modeDot,
                          { backgroundColor: colors.brand },
                        ]}
                      />
                    )}
                  </Pressable>
                  <TransportButton
                    icon="play-back"
                    size={SKIP_SIZE}
                    label="Previous track"
                    onPress={() => previous()}
                  />
                  <TransportButton
                    icon={isPlaying ? "pause" : "play"}
                    size={PLAY_SIZE}
                    label={isPlaying ? "Pause" : "Play"}
                    onPress={() => togglePlayback()}
                  />
                  <TransportButton
                    icon="play-forward"
                    size={SKIP_SIZE}
                    label="Next track"
                    onPress={() => next()}
                  />
                  <Pressable
                    onPress={() =>
                      setRepeatMode(NEXT_REPEAT_MODE[modes.repeat])
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: modes.repeat !== "off" }}
                    accessibilityLabel={`Repeat: ${modes.repeat}`}
                  >
                    {modes.repeat === "one" ? (
                      <MaterialIcons
                        name="repeat-one"
                        size={28}
                        color={colors.brand}
                      />
                    ) : (
                      <Ionicons
                        name="repeat"
                        size={28}
                        color={
                          modes.repeat === "all" ? colors.brand : colors.subtle
                        }
                      />
                    )}
                  </Pressable>
                </View>
                <View style={styles.toolbar}>
                  <DevicesButton
                    color={colors.text}
                    activeColor={colors.brand}
                  />
                  <OutputButton
                    color={colors.text}
                    activeColor={colors.brand}
                  />
                  <View style={styles.toolbarSpacer} />
                  <Pressable
                    onPress={() => {
                      setShowQueue(false);
                      setLyricsOpen(!lyricsOpen);
                    }}
                    disabled={!lyrics.available}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: showLyrics,
                      disabled: !lyrics.available,
                    }}
                    accessibilityLabel="Lyrics"
                    style={[
                      styles.toolbarButton,
                      showLyrics && { backgroundColor: colors.selectedFill },
                    ]}
                  >
                    <MaterialIcons
                      name="lyrics"
                      size={24}
                      color={
                        !lyrics.available
                          ? colors.faint
                          : showLyrics
                            ? tint
                            : colors.text
                      }
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setLyricsOpen(false);
                      setShowQueue((shown) => !shown);
                    }}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityState={{ selected: showQueue }}
                    accessibilityLabel="Queue"
                    style={[
                      styles.toolbarButton,
                      showQueue && { backgroundColor: colors.selectedFill },
                    ]}
                  >
                    <Ionicons
                      name="list"
                      size={24}
                      color={showQueue ? tint : colors.text}
                    />
                  </Pressable>
                </View>
              </View>
            </GestureDetector>
          )}
        </LayoutAnimationConfig>
      </Animated.View>
      {track && (
        // One copy of the art, moved between the two views' slots so it
        // travels instead of swapping. Above the sheet, not in it, so it can
        // leave the sheet for the mini player.
        <Animated.View
          style={[styles.art, { width: art.size, height: art.size }, art.style]}
        >
          {art.size > 0 && (
            <PlayerArtwork
              url={track.artwork}
              coverPath={track.coverPath}
              size={art.size}
              borderRadius={0}
              onLoad={swipe.onCoverLoad}
            />
          )}
        </Animated.View>
      )}
      <AddToPlaylistSheet
        selection={addToPlaylist.selection}
        onClose={addToPlaylist.close}
      />
    </GestureHandlerRootView>
  );
}

function describeFileQuality(
  audioFormat: string | null | undefined,
  bitrateKbps: number | null,
) {
  if (!audioFormat && !bitrateKbps) return null;
  const rate = bitrateKbps ? `${bitrateKbps} kbps` : null;
  const spokenRate = bitrateKbps ? `${bitrateKbps} kilobits per second` : null;
  return {
    shown: [audioFormat, rate].filter(Boolean).join(" · "),
    spoken: [audioFormat, spokenRate].filter(Boolean).join(", "),
  };
}

/**
 * The art renders at the player view's size and is scaled, not resized, into
 * the queue header. `swipeOffset` slides it sideways for a skip. It rides the
 * sheet, and as the sheet enters or leaves on its own it travels between its
 * slot and `miniCover`.
 */
function useArtFrame(
  swipeOffset: SharedValue<number>,
  sheet: {
    translateY: SharedValue<number>;
    dismissal: SharedValue<number>;
  },
  miniCover: SharedValue<CoverFrame | null>,
  estimatedSlotSide: number,
) {
  const [size, setSize] = useState(0);
  const fullSize = useSharedValue(0);
  const shownSize = useSharedValue(0);
  const left = useSharedValue(0);
  const top = useSharedValue(0);
  const hasPlaced = useRef(false);

  const moveTo = useCallback(
    (nextLeft: number, nextTop: number, nextSize: number) => {
      if (!hasPlaced.current) {
        hasPlaced.current = true;
        left.set(nextLeft);
        top.set(nextTop);
        shownSize.set(nextSize);
        return;
      }
      left.set(withTiming(nextLeft, ART_MOVE_TIMING));
      top.set(withTiming(nextTop, ART_MOVE_TIMING));
      shownSize.set(withTiming(nextSize, ART_MOVE_TIMING));
    },
    [left, shownSize, top],
  );

  // The slots are children of the top area, which starts at the sheet's
  // origin, so their frames are in the art's coordinates less the sheet's
  // offset.
  const onArtSlotLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x: slotX, y: slotY, width, height } = event.nativeEvent.layout;
      const side = Math.floor(Math.min(width, height));
      setSize(side);
      fullSize.set(side);
      moveTo(slotX + (width - side) / 2, slotY, side);
    },
    [fullSize, moveTo],
  );

  const onThumbRowLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x: rowX, y: rowY, height } = event.nativeEvent.layout;
      // Opened straight into lyrics or the queue, the slot never laid out, so
      // the art renders at the size the slot would give it.
      if (fullSize.get() === 0) {
        setSize(estimatedSlotSide);
        fullSize.set(estimatedSlotSide);
      }
      moveTo(rowX, rowY + (height - THUMB_SIZE) / 2, THUMB_SIZE);
    },
    [estimatedSlotSide, fullSize, moveTo],
  );

  const style = useAnimatedStyle(() => {
    const full = fullSize.get();
    if (full === 0) return { opacity: 0 };
    const cover = miniCover.get();
    const landing = cover ? sheet.dismissal.get() : 0;
    const inSlot = shownSize.get();
    const slotRadius = interpolate(
      inSlot,
      [THUMB_SIZE, full],
      [THUMB_RADIUS, ART_RADIUS],
      Extrapolation.CLAMP,
    );
    const x = left.get() + swipeOffset.get();
    const y = top.get() + sheet.translateY.get();
    const to = cover ?? { x, y, size: inSlot };
    const shown = mix(inSlot, to.size, landing);
    const scale = shown / full;
    // Scaling pivots on the center; this keeps the top-left corner in place.
    const offset = (shown - full) / 2;
    const radius = mix(slotRadius, MINI_COVER_RADIUS, landing);
    return {
      opacity: 1,
      // The corner scales with the art, so it is set pre-scale.
      borderRadius: radius / scale,
      transform: [
        { translateX: mix(x, to.x, landing) + offset },
        { translateY: mix(y, to.y, landing) + offset },
        { scale },
      ],
    };
  });

  return { size, style, onArtSlotLayout, onThumbRowLayout };
}

function mix(from: number, to: number, progress: number) {
  "worklet";
  return from + (to - from) * progress;
}

function TransportButton({
  icon,
  size,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  size: number;
  label: string;
  onPress: () => void;
}) {
  const colors = usePlayerColors();
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useReducedMotion();
  const haloSize = size + 28;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={8}
      pressRetentionOffset={16}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.transportButton}
    >
      <Animated.View
        style={[
          styles.pressHalo,
          { backgroundColor: colors.pressedFill },
          PRESS_FEEDBACK_TRANSITION,
          { width: haloSize, height: haloSize, borderRadius: haloSize / 2 },
          { opacity: pressed ? 1 : 0 },
        ]}
      />
      <Animated.View
        style={[
          PRESS_FEEDBACK_TRANSITION,
          { transform: [{ scale: pressed && !reduceMotion ? 0.9 : 1 }] },
        ]}
      >
        <Ionicons name={icon} size={size} color={colors.text} />
      </Animated.View>
    </Pressable>
  );
}

function Grabber({ onPress }: { onPress: () => void }) {
  const colors = usePlayerColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close player"
      style={styles.grabberHit}
    >
      <View style={[styles.grabber, { backgroundColor: colors.faint }]} />
    </Pressable>
  );
}

function TrackTitles({
  track,
  align,
  onTitlePress,
  onArtistPress,
}: {
  track: PlayerTrack;
  align: "center" | "start";
  onTitlePress?: () => void;
  onArtistPress?: () => void;
}) {
  const colors = usePlayerColors();
  const centered = align === "center";

  return (
    <View
      style={[
        styles.titles,
        centered
          ? { alignItems: "center", gap: 6 }
          : { alignItems: "flex-start", gap: 2 },
      ]}
    >
      {/* Stretched, so the marquee keeps the full width to scroll in. */}
      <Pressable
        onPress={onTitlePress}
        disabled={!onTitlePress}
        hitSlop={8}
        accessibilityRole={onTitlePress ? "button" : undefined}
        accessibilityLabel={
          onTitlePress ? `View album ${track.album || track.title}` : undefined
        }
        style={({ pressed }) => [styles.titlePress, pressed && styles.pressed]}
      >
        <MarqueeText
          variant="subtitle"
          align={align}
          style={[
            Fonts.semiBold,
            centered ? styles.titleLarge : styles.titleCompact,
            { color: colors.text },
          ]}
        >
          {track.title}
        </MarqueeText>
      </Pressable>
      <Pressable
        onPress={onArtistPress}
        disabled={!onArtistPress}
        hitSlop={8}
        style={({ pressed }) => pressed && styles.pressed}
        accessibilityRole={onArtistPress ? "button" : undefined}
        accessibilityLabel={
          onArtistPress ? `View artist ${track.artist}` : undefined
        }
      >
        <Text
          variant="caption"
          numberOfLines={1}
          style={[
            centered ? styles.subtitleLarge : styles.subtitleCompact,
            { color: colors.subtle },
          ]}
        >
          {track.artist}
        </Text>
      </Pressable>
    </View>
  );
}

function FavoriteButton({
  favorite,
  trackMbid,
  trackTitle,
}: {
  favorite: TrackFavorite;
  trackMbid: string | null;
  trackTitle: string;
}) {
  const { data: isFavoriteOnServer = false, isPending: isCheckingFavorite } =
    useIsFavoriteTrack(favorite, trackMbid);
  const colors = usePlayerColors();
  const toggleFavorite = useToggleFavorite();
  // Shows the tap at once. A refused toggle falls back to the server's answer.
  const isFavorite = toggleFavorite.isPending
    ? toggleFavorite.variables.starred
    : isFavoriteOnServer;

  return (
    <Pressable
      onPress={() => {
        if (isCheckingFavorite || toggleFavorite.isPending) return;
        toggleFavorite.mutate({ ...favorite, starred: !isFavorite });
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        isFavorite
          ? `Remove ${trackTitle} from favorites`
          : `Add ${trackTitle} to favorites`
      }
    >
      <Ionicons
        name={isFavorite ? "heart" : "heart-outline"}
        size={26}
        color={colors.text}
      />
    </Pressable>
  );
}

function queueRowKey(row: QueueRow): string {
  return row.kind === "track" ? row.item.id : row.kind;
}

function QueueEmptyRow() {
  const colors = usePlayerColors();
  return (
    <Text
      variant="caption"
      style={[styles.upNextEmpty, { color: colors.subtle }]}
    >
      Nothing up next.
    </Text>
  );
}

/** The same setting as in Settings › Playback and Storage. */
function AutoplayHeading() {
  const colors = usePlayerColors();
  const { autoplay } = usePlaybackSettings();
  return (
    <View style={styles.autoplayHeading}>
      <Text
        variant="subtitle"
        style={[styles.queueHeadingText, { color: colors.text }]}
      >
        Autoplay
      </Text>
      <Host matchContents ignoreSafeArea="all">
        <SettingsSwitch
          value={autoplay}
          accessibilityLabel="Autoplay"
          onChange={(next) => setPlaybackSettings({ autoplay: next })}
        />
      </Host>
    </View>
  );
}

function UpNextRow({ item }: { item: PlayerTrack }) {
  const colors = usePlayerColors();
  // Offline, a track the phone hasn't saved is passed over, so it shows as
  // unavailable rather than as next.
  const unavailable = !useCanPlayNow(item.id);
  return (
    <Pressable
      onPress={() =>
        unavailable ? toastNotSaved() : void playQueueItem(item.id)
      }
      accessibilityRole="button"
      accessibilityLabel={`Play ${item.title} by ${item.artist}`}
      accessibilityState={{ disabled: unavailable }}
      style={({ pressed }) => [
        styles.upNextRow,
        {
          borderBottomColor: colors.separator,
          opacity: unavailable ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <PlayerArtwork
        url={item.artwork}
        coverPath={item.coverPath}
        size={44}
        borderRadius={6}
      />
      <View style={styles.upNextMeta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[Fonts.medium, { color: colors.text }]}
        >
          {item.title}
        </Text>
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: colors.subtle }}
        >
          {item.artist}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: "#000000",
  },
  sheet: {
    flex: 1,
    overflow: "hidden",
  },
  top: {
    paddingHorizontal: GUTTER,
  },
  topFill: {
    flex: 1,
  },
  grabberHit: {
    alignSelf: "center",
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 24,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Shrinks the art on a short screen rather than crowding the controls.
  artSlot: {
    flexShrink: 1,
  },
  artSpacer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
  },
  titles: {
    flex: 1,
  },
  titlePress: {
    alignSelf: "stretch",
  },
  pressed: {
    opacity: 0.6,
  },
  titleLarge: {
    fontSize: 24,
    lineHeight: 30,
  },
  subtitleLarge: {
    fontSize: 18,
    lineHeight: 24,
  },
  titleCompact: {
    fontSize: 18,
    lineHeight: 23,
  },
  subtitleCompact: {
    fontSize: 15,
    lineHeight: 20,
  },
  // The sides keep their width when empty, so the file's quality stays centered.
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionSlot: {
    width: 44,
    height: 44,
    justifyContent: "center",
  },
  actionSlotStart: {
    alignItems: "flex-start",
  },
  actionSlotEnd: {
    alignItems: "flex-end",
  },
  fileQuality: {
    flex: 1,
    textAlign: "center",
  },
  thumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  thumbPlaceholder: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  queue: {
    flex: 1,
  },
  queueHeading: {
    ...QUEUE_HEADING_TEXT,
    paddingHorizontal: GUTTER,
    marginBottom: 8,
  },
  queueHeadingText: QUEUE_HEADING_TEXT,
  autoplayHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: GUTTER,
    marginTop: 20,
    marginBottom: 8,
  },
  queueList: {
    flex: 1,
  },
  lyrics: {
    flex: 1,
  },
  queueContent: {
    paddingBottom: 8,
  },
  upNextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  upNextMeta: {
    flex: 1,
    gap: 2,
  },
  upNextEmpty: {
    paddingHorizontal: GUTTER,
    paddingTop: 8,
  },
  controls: {
    paddingHorizontal: GUTTER,
    paddingTop: 16,
    gap: 12,
  },
  transport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  modeButton: {
    alignItems: "center",
  },
  // Out of the flow, so the row doesn't shift when it appears.
  modeDot: {
    position: "absolute",
    bottom: -8,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  transportButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressHalo: {
    position: "absolute",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
  toolbarSpacer: {
    flex: 1,
  },
  toolbarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  art: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "hidden",
    pointerEvents: "none",
    boxShadow: ARTWORK_SHADOW,
  },
});
