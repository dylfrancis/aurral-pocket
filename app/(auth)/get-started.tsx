import { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { AurralLogo } from '@/components/AurralLogo';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_WIDTH - 48) / 3;
const CARD_GAP = 8;
const CARD_TOTAL = CARD_SIZE + CARD_GAP;
const NUM_ROWS = Math.ceil((SCREEN_HEIGHT * 0.65) / CARD_TOTAL) + 2;

const PALETTE_DARK = [
  '#3a2e2e', '#2e3a2e', '#2e2e3a', '#3a352e',
  '#352e3a', '#2e3a35', '#3a2e35', '#2e353a',
  '#33302e', '#2e3330', '#302e33', '#332e30',
  '#3a3333', '#333a33', '#33333a', '#3a3a33',
  '#2e2e2e', '#353535', '#3a3a3a', '#302e35',
  '#352e30', '#2e3530', '#303530', '#353030',
];

const PALETTE_LIGHT = [
  '#d4cfc4', '#c4d4c4', '#c4c4d4', '#d4d0c4',
  '#d0c4d4', '#c4d4d0', '#d4c4d0', '#c4d0d4',
  '#cccac4', '#c4ccca', '#cac4cc', '#ccc4ca',
  '#d4cccc', '#ccd4cc', '#ccccd4', '#d4d4cc',
  '#c4c4c4', '#cacaca', '#d0d0d0', '#cac4d0',
  '#d0c4ca', '#c4d0ca', '#cad0ca', '#d0caca',
];

function generateCards(palette: string[]) {
  return Array.from({ length: 3 * NUM_ROWS * 2 }, (_, i) => ({
    id: i,
    color: palette[i % palette.length],
  }));
}

function ScrollingColumn({
  cards,
  speed,
  offset,
}: {
  cards: { id: number; color: string }[];
  speed: number;
  offset: number;
}) {
  const translateY = useSharedValue(0);
  const totalHeight = (NUM_ROWS * CARD_TOTAL);

  useEffect(() => {
    translateY.value = 0;
    translateY.value = withRepeat(
      withTiming(-totalHeight, {
        duration: speed,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [translateY, totalHeight, speed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + offset }],
  }));

  return (
    <Animated.View style={[styles.column, animatedStyle]}>
      {cards.map((card) => (
        <View
          key={card.id}
          style={[
            styles.card,
            { backgroundColor: card.color },
          ]}
        />
      ))}
    </Animated.View>
  );
}

export default function GetStartedScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const palette = colorScheme === 'dark' ? PALETTE_DARK : PALETTE_LIGHT;
  const cards = generateCards(palette);

  const col1 = cards.slice(0, NUM_ROWS * 2);
  const col2 = cards.slice(NUM_ROWS * 2, NUM_ROWS * 4);
  const col3 = cards.slice(NUM_ROWS * 4, NUM_ROWS * 6);

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/connect');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Scrolling cards background */}
      <View style={styles.cardsContainer}>
        <ScrollingColumn cards={col1} speed={60000} offset={0} />
        <ScrollingColumn cards={col2} speed={45000} offset={-CARD_TOTAL / 2} />
        <ScrollingColumn cards={col3} speed={55000} offset={-CARD_TOTAL / 3} />
      </View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={[
          'transparent',
          colorScheme === 'dark' ? 'rgba(5,5,5,0.6)' : 'rgba(245,244,241,0.6)',
          colors.background,
        ]}
        locations={[0, 0.3, 0.55]}
        style={styles.gradient}
      />

      {/* Content */}
      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <AurralLogo size={56} />
        <Text style={[styles.headline, { color: colors.text, fontFamily: Fonts.bold }]}>
          A new way to{'\n'}discover music
        </Text>
        <Text style={[styles.subtext, { color: colors.subtle, fontFamily: Fonts.regular }]}>
          Your personal music companion
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: colors.buttonPrimary }]}
          onPress={handleGetStarted}
        >
          <Text style={[styles.buttonText, { color: colors.buttonPrimaryText, fontFamily: Fonts.semiBold }]}>
            Get Started
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.65,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: CARD_GAP,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  column: {
    width: CARD_SIZE,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 12,
  },
  gradient: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.3,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.45,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  headline: {
    fontSize: 32,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 40,
  },
  subtext: {
    fontSize: 17,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    width: '100%',
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
  },
});
