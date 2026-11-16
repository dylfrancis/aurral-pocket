import { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { usePlayerColors } from "@/components/player/player-colors";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useActiveLyricLine } from "@/hooks/player/use-active-lyric-line";
import { seekTo } from "@/lib/player/player";
import type { LyricLine, Lyrics } from "@/lib/types/lyrics";

const GUTTER = 16;
/** Where the sung line sits, as a share of the view's height from the top. */
const LINE_ANCHOR = 0.3;
/** How long after a scroll by hand the view goes back to the sung line. */
const FOLLOW_RESUME_MS = 3000;
const INACTIVE_OPACITY = 0.35;
const LINE_FADE = {
  transitionProperty: "opacity",
  transitionDuration: 250,
  transitionTimingFunction: "ease-out",
} as const;

/** `lyrics` is null while they load. */
export function LyricsView({
  trackId,
  lyrics,
}: {
  trackId: string;
  lyrics: Lyrics | null;
}) {
  const colors = usePlayerColors();
  if (!lyrics) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          color={colors.subtle}
          accessibilityLabel="Loading lyrics"
        />
      </View>
    );
  }
  if (!lyrics.synced) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.plainText, { color: colors.text }]}>
          {lyrics.lines.map((line) => line.value).join("\n")}
        </Text>
      </ScrollView>
    );
  }
  return <SyncedLyrics trackId={trackId} lines={lyrics.lines} />;
}

/**
 * Follows the sung line. A scroll by hand holds it, and it goes back to the
 * sung line a few seconds after the scroll ends. A tap on a line plays from it.
 */
function SyncedLyrics({
  trackId,
  lines,
}: {
  trackId: string;
  lines: LyricLine[];
}) {
  const colors = usePlayerColors();
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const active = useActiveLyricLine(trackId, lines);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const viewportHeight = useRef(0);
  const lineTops = useRef<number[]>([]);
  const activeRef = useRef(active);
  const placed = useRef(false);
  const following = useRef(true);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToLine = useCallback((index: number, animated: boolean) => {
    const top = index < 0 ? 0 : lineTops.current[index];
    if (top === undefined) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, top - viewportHeight.current * LINE_ANCHOR),
      animated,
    });
  }, []);

  // Opened partway through a song, the view starts at the sung line, once
  // both it and the view have been measured.
  const placeOnce = useCallback(() => {
    const index = activeRef.current;
    if (placed.current || viewportHeight.current === 0) return;
    if (index >= 0 && lineTops.current[index] === undefined) return;
    placed.current = true;
    scrollToLine(index, false);
  }, [scrollToLine]);

  useEffect(() => {
    activeRef.current = active;
    if (!placed.current) {
      placeOnce();
    } else if (following.current) {
      scrollToLine(active, !reduceMotion);
    }
  }, [active, placeOnce, reduceMotion, scrollToLine]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  const stopResume = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
  };

  const holdForScroll = () => {
    following.current = false;
    stopResume();
  };

  // iOS also ends a scrollTo's animation with onMomentumScrollEnd, so only a
  // scroll by hand, which turned following off, schedules the return.
  const resumeAfterScroll = () => {
    if (following.current) return;
    stopResume();
    resumeTimer.current = setTimeout(() => {
      following.current = true;
      scrollToLine(activeRef.current, !reduceMotion);
    }, FOLLOW_RESUME_MS);
  };

  const playFromLine = (line: LyricLine) => {
    following.current = true;
    stopResume();
    // A failed seek leaves the song, and the sung line, where they were.
    seekTo((line.start ?? 0) / 1000).catch(() => {});
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        // Lets the last lines come up to where the sung line sits.
        { paddingBottom: windowHeight / 2 },
      ]}
      onLayout={(event) => {
        viewportHeight.current = event.nativeEvent.layout.height;
        placeOnce();
      }}
      onScrollBeginDrag={holdForScroll}
      onScrollEndDrag={resumeAfterScroll}
      onMomentumScrollBegin={() => {
        if (!following.current) stopResume();
      }}
      onMomentumScrollEnd={resumeAfterScroll}
    >
      {lines.map((line, index) => (
        <Animated.View
          // Lines have no ids, and the list never reorders.
          key={index}
          onLayout={(event: LayoutChangeEvent) => {
            lineTops.current[index] = event.nativeEvent.layout.y;
            placeOnce();
          }}
          style={[
            LINE_FADE,
            { opacity: index === active ? 1 : INACTIVE_OPACITY },
          ]}
        >
          <Pressable
            onPress={() => playFromLine(line)}
            accessibilityRole="button"
            accessibilityState={{ selected: index === active }}
            accessibilityHint="Plays from this line"
            // A gap between sung lines, which a screen reader passes over.
            aria-hidden={!line.value}
            style={({ pressed }) => pressed && styles.pressedLine}
          >
            <Text style={[styles.syncedLine, { color: colors.text }]}>
              {line.value || "♪"}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: 8,
    paddingBottom: 24,
  },
  syncedLine: {
    ...Fonts.bold,
    fontSize: 24,
    lineHeight: 31,
    paddingVertical: 8,
  },
  pressedLine: {
    opacity: 0.6,
  },
  plainText: {
    ...Fonts.semiBold,
    fontSize: 20,
    lineHeight: 30,
  },
});
