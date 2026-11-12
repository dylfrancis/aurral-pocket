import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useRouter, type Href } from "expo-router";
import { useCallback, useRef, useState, type ComponentProps } from "react";
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
import { PlayerArtwork } from "@/components/player/PlayerArtwork";
import {
  ARTWORK_SHADOW,
  PlayerColors,
  usePlayerColors,
} from "@/components/player/player-colors";
import { Scrubber } from "@/components/player/Scrubber";
import { TrackMenu } from "@/components/player/TrackMenu";
import type {
  TrackMenuAction,
  TrackMenuActionId,
} from "@/components/player/track-menu-types";
import { MarqueeText } from "@/components/ui/MarqueeText";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import {
  useIsFavoriteTrack,
  useToggleFavorite,
} from "@/hooks/library/use-library-favorites";
import { useCoverTint } from "@/hooks/player/use-cover-color";
import { useDragToClose } from "@/hooks/player/use-drag-to-close";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { TrackFavorite } from "@/lib/api/library";
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
import type { PlayerTrack } from "@/lib/player/track-item";

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

/**
 * Progress lives in the Scrubber alone; everything else here reads track,
 * state, queue, and modes, so a progress tick re-renders nothing but the
 * scrubber.
 */
export function NowPlayingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const track = useCurrentTrack();
  const state = usePlaybackState();
  const modes = usePlayerModes();
  const { items, currentId, album } = useQueue();
  const colors = PlayerColors[useColorScheme()];
  const tint = useCoverTint(track);
  const [showQueue, setShowQueue] = useState(false);
  const art = useArtFrame();

  const close = useCallback(() => router.back(), [router]);
  const drag = useDragToClose(close);
  // Two drag areas, so the Up Next list between them can scroll.
  const topPan = usePanGesture(drag.panConfig);
  const controlsPan = usePanGesture(drag.panConfig);

  const isPlaying = state === "playing" || state === "buffering";
  // A missing match means the engine is on an item the facade did not
  // queue; an empty list beats presenting the whole queue as "up next".
  const currentIndex = items.findIndex((it) => it.id === currentId);
  const upNext = currentIndex < 0 ? [] : items.slice(currentIndex + 1);
  // A playlist's tracks each have their own artist, and its context has none.
  const artistMbid = track?.artistMbid ?? album?.artistMbid ?? null;

  // The player sits over the tabs, so it must go before a page can show. The
  // paths name the library group — a bare /artist/[mbid] resolves into
  // (activity), the first group with the route. navigate, not push: repeated
  // taps must not stack duplicate pages.
  const leaveFor = useCallback(
    (href: Href) => {
      router.back();
      router.navigate(href);
    },
    [router],
  );

  const openArtist = useCallback(() => {
    if (!artistMbid) return;
    leaveFor({
      pathname: "/(app)/(tabs)/(library)/artist/[mbid]",
      params: { mbid: artistMbid },
    });
  }, [artistMbid, leaveFor]);

  const addToPlaylist = useAddToPlaylist();
  const menuActions: TrackMenuAction[] = [];
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

  const onMenuAction = (id: TrackMenuActionId) => {
    if (!track) return;
    if (id === "playlist") {
      addToPlaylist.open({
        artistName: track.artist,
        trackName: track.title,
        albumName: track.album || null,
        artistMbid,
        albumMbid: track.albumMbid,
        trackMbid: track.trackMbid,
      });
    } else if (id === "album" && track.albumRef) {
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
    } else if (id === "artist") {
      openArtist();
    }
  };

  const renderUpNextRow = useCallback(
    ({ item }: { item: PlayerTrack }) => <UpNextRow item={item} />,
    [],
  );

  const fileQuality = track ? describeFileQuality(track) : null;

  const favorite = track?.favorite ? (
    <FavoriteButton
      // Remounts per track, so a toggle still in flight doesn't show on the
      // next one.
      key={`${track.favorite.kind}:${track.favorite.key}`}
      favorite={track.favorite}
      trackMbid={track.trackMbid}
      trackTitle={track.title}
    />
  ) : null;

  return (
    // A native modal sits outside the app root's gesture and sheet hosts, so
    // the player brings its own.
    <GestureHandlerRootView style={styles.screen}>
      <BottomSheetModalProvider>
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
                  (!track || !showQueue) && styles.topFill,
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
                ) : showQueue ? (
                  <Animated.View
                    entering={SWAP_FADE}
                    style={styles.thumbRow}
                    onLayout={art.onThumbRowLayout}
                  >
                    <View style={styles.thumbPlaceholder} />
                    <TrackTitles
                      track={track}
                      align="start"
                      onArtistPress={artistMbid ? openArtist : undefined}
                    />
                  </Animated.View>
                ) : (
                  <>
                    <View
                      style={[
                        styles.artSlot,
                        { maxHeight: width - GUTTER * 2 },
                      ]}
                      onLayout={art.onArtSlotLayout}
                    />
                    <Animated.View entering={SWAP_FADE} style={styles.titleRow}>
                      <TrackTitles
                        track={track}
                        align="center"
                        onArtistPress={artistMbid ? openArtist : undefined}
                      />
                    </Animated.View>
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
                  data={upNext}
                  renderItem={renderUpNextRow}
                  keyExtractor={(item) => item.id}
                  style={styles.queueList}
                  contentContainerStyle={styles.queueContent}
                  ListEmptyComponent={
                    <Text
                      variant="caption"
                      style={[styles.upNextEmpty, { color: colors.subtle }]}
                    >
                      Nothing up next.
                    </Text>
                  }
                />
              </Animated.View>
            )}

            {track && (
              <GestureDetector gesture={controlsPan}>
                <View
                  style={[
                    styles.controls,
                    { paddingBottom: insets.bottom + 8 },
                  ]}
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
                      {menuActions.length > 0 && (
                        <TrackMenu
                          actions={menuActions}
                          onAction={onMenuAction}
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
                            modes.repeat === "all"
                              ? colors.brand
                              : colors.subtle
                          }
                        />
                      )}
                    </Pressable>
                  </View>
                  <View style={styles.toolbar}>
                    <Pressable
                      onPress={() => setShowQueue((shown) => !shown)}
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

            {track && (
              // One copy of the art, moved between the two views' slots so it
              // travels instead of swapping.
              <Animated.View
                style={[
                  styles.art,
                  { width: art.size, height: art.size },
                  art.style,
                ]}
              >
                {art.size > 0 && (
                  <PlayerArtwork
                    url={track.artwork}
                    coverPath={track.coverPath}
                    size={art.size}
                    borderRadius={0}
                  />
                )}
              </Animated.View>
            )}
          </LayoutAnimationConfig>
        </Animated.View>
        <AddToPlaylistSheet
          track={addToPlaylist.track}
          onClose={addToPlaylist.close}
        />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

function describeFileQuality(track: PlayerTrack) {
  const { audioFormat, bitrateKbps } = track;
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
 * the queue header.
 */
function useArtFrame() {
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
  // origin, so their frames are already in the art's coordinates.
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
      moveTo(rowX, rowY + (height - THUMB_SIZE) / 2, THUMB_SIZE);
    },
    [moveTo],
  );

  const style = useAnimatedStyle(() => {
    const full = fullSize.get();
    if (full === 0) return { opacity: 0 };
    const shown = shownSize.get();
    const scale = shown / full;
    // Scaling pivots on the center; this keeps the top-left corner in place.
    const offset = (shown - full) / 2;
    const radius = interpolate(
      shown,
      [THUMB_SIZE, full],
      [THUMB_RADIUS, ART_RADIUS],
      Extrapolation.CLAMP,
    );
    return {
      opacity: 1,
      // The corner scales with the art, so it is set pre-scale.
      borderRadius: radius / scale,
      transform: [
        { translateX: left.get() + offset },
        { translateY: top.get() + offset },
        { scale },
      ],
    };
  });

  return { size, style, onArtSlotLayout, onThumbRowLayout };
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
  onArtistPress,
}: {
  track: PlayerTrack;
  align: "center" | "start";
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
      <Pressable
        onPress={onArtistPress}
        disabled={!onArtistPress}
        hitSlop={8}
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

function UpNextRow({ item }: { item: PlayerTrack }) {
  const colors = usePlayerColors();
  return (
    <Pressable
      onPress={() => playQueueItem(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Play ${item.title} by ${item.artist}`}
      style={({ pressed }) => [
        styles.upNextRow,
        { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
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
    ...Fonts.semiBold,
    fontSize: 18,
    paddingHorizontal: GUTTER,
    marginBottom: 8,
  },
  queueList: {
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
