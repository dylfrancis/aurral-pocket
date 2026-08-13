import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts, Radius } from "@/constants/theme";
import type { LetterIndexEntry } from "@/lib/alphabet-index";

const BUBBLE_SIZE = 56;
const BUBBLE_GAP = 24;

type AlphabetIndexProps = {
  entries: LetterIndexEntry[];
  onSelect: (entry: LetterIndexEntry) => void;
};

export function AlphabetIndex({ entries, onSelect }: AlphabetIndexProps) {
  const colors = Colors[useColorScheme()];
  const stripHeight = useRef(0);
  const lastLetter = useRef<string | null>(null);
  // The bubble stays centered on the screen; a letter change only swaps the
  // bubble text, so a scrub does not relayout the strip or move the bubble.
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const [bubbleScale] = useState(() => new Animated.Value(0));
  const bubbleVisible = activeLetter !== null;

  useEffect(() => {
    if (bubbleVisible) {
      Animated.spring(bubbleScale, {
        toValue: 1,
        speed: 24,
        bounciness: 9,
        useNativeDriver: true,
      }).start();
    } else {
      bubbleScale.setValue(0);
    }
  }, [bubbleVisible, bubbleScale]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    stripHeight.current = event.nativeEvent.layout.height;
  }, []);

  const handleTouch = useCallback(
    (event: GestureResponderEvent) => {
      if (entries.length === 0 || stripHeight.current <= 0) return;
      const rowHeight = stripHeight.current / entries.length;
      const touchedRow = Math.floor(event.nativeEvent.locationY / rowHeight);
      const row = Math.min(entries.length - 1, Math.max(0, touchedRow));
      const entry = entries[row];
      if (entry.letter === lastLetter.current) return;
      lastLetter.current = entry.letter;
      setActiveLetter(entry.letter);
      Haptics.selectionAsync();
      onSelect(entry);
    },
    [entries, onSelect],
  );

  const handleRelease = useCallback(() => {
    lastLetter.current = null;
    setActiveLetter(null);
  }, []);

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View
        testID="alphabet-index"
        accessibilityLabel="Alphabet index"
        style={styles.strip}
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleRelease}
      >
        <View pointerEvents="none">
          {entries.map(({ letter }) => (
            <Text key={letter} style={[styles.letter, { color: colors.brand }]}>
              {letter}
            </Text>
          ))}
        </View>
      </View>
      {activeLetter !== null && (
        <Animated.View
          testID="alphabet-index-bubble"
          pointerEvents="none"
          style={[
            styles.bubble,
            {
              backgroundColor: colors.brand,
              transform: [{ scale: bubbleScale }],
            },
          ]}
        >
          <Text
            style={[styles.bubbleLetter, { color: colors.buttonPrimaryText }]}
          >
            {activeLetter}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    justifyContent: "center",
  },
  strip: {
    paddingHorizontal: 6,
  },
  bubble: {
    position: "absolute",
    top: "50%",
    marginTop: -BUBBLE_SIZE / 2,
    right: BUBBLE_SIZE / 2 + BUBBLE_GAP,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: Radius.round,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  letter: {
    fontSize: 11,
    lineHeight: 14,
    ...Fonts.semiBold,
    textAlign: "center",
  },
  bubbleLetter: {
    fontSize: 24,
    lineHeight: 28,
    ...Fonts.bold,
  },
});
