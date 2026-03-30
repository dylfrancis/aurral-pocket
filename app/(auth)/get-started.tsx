import { useEffect, useMemo, useRef } from 'react';
import { Dimensions, Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { AurralLogo } from '@/components/AurralLogo';
import { ConnectSheet } from './components/ConnectSheet';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_WIDTH - 48) / 3;
const CARD_GAP = 8;
const CARD_TOTAL = CARD_SIZE + CARD_GAP;

const COVERS: ImageSourcePropType[] = [
  require('@/assets/images/covers/01.jpg'),
  require('@/assets/images/covers/02.jpg'),
  require('@/assets/images/covers/03.jpg'),
  require('@/assets/images/covers/04.jpg'),
  require('@/assets/images/covers/05.jpg'),
  require('@/assets/images/covers/06.jpg'),
  require('@/assets/images/covers/07.jpg'),
  require('@/assets/images/covers/08.jpg'),
  require('@/assets/images/covers/09.jpg'),
  require('@/assets/images/covers/10.jpg'),
  require('@/assets/images/covers/11.jpg'),
  require('@/assets/images/covers/12.jpg'),
  require('@/assets/images/covers/13.jpg'),
  require('@/assets/images/covers/14.jpg'),
  require('@/assets/images/covers/15.jpg'),
  require('@/assets/images/covers/16.jpg'),
  require('@/assets/images/covers/17.jpg'),
  require('@/assets/images/covers/18.jpg'),
  require('@/assets/images/covers/19.jpg'),
  require('@/assets/images/covers/20.jpg'),
  require('@/assets/images/covers/21.jpg'),
  require('@/assets/images/covers/22.jpg'),
  require('@/assets/images/covers/23.jpg'),
  require('@/assets/images/covers/24.jpg'),
  require('@/assets/images/covers/25.jpg'),
  require('@/assets/images/covers/26.jpg'),
  require('@/assets/images/covers/27.jpg'),
  require('@/assets/images/covers/28.jpg'),
  require('@/assets/images/covers/29.jpg'),
  require('@/assets/images/covers/30.jpg'),
  require('@/assets/images/covers/31.jpg'),
  require('@/assets/images/covers/32.jpg'),
  require('@/assets/images/covers/33.jpg'),
  require('@/assets/images/covers/34.jpg'),
  require('@/assets/images/covers/35.jpg'),
  require('@/assets/images/covers/36.jpg'),
  require('@/assets/images/covers/37.jpg'),
  require('@/assets/images/covers/38.jpg'),
  require('@/assets/images/covers/39.jpg'),
  require('@/assets/images/covers/40.jpg'),
];

/**
 * Returns a new array containing the elements of the input array shuffled in a pseudo-random order,
 * determined by the provided seed value.
 *
 * @param arr The input array to be shuffled.
 * @param seed A number used as the seed for the pseudo-random number generator, ensuring deterministic shuffling.
 * @return A new array with the elements shuffled in a pseudo-random order.
 */
function shuffled<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generates a two-dimensional array of image sources divided into columns.
 * The images are shuffled based on the provided seed value.
 *
 * @param {number} seed - The seed value used to shuffle the array of image sources.
 * @return {ImageSourcePropType[][]} A two-dimensional array where each sub-array represents a column of image sources.
 */
function generateColumns(seed: number): ImageSourcePropType[][] {
  const all = shuffled(COVERS, seed);
  const perCol = Math.floor(all.length / 3);
  return [0, 1, 2].map((colIdx) => {
    return all.slice(colIdx * perCol, (colIdx + 1) * perCol);
  });
}

/**
 * Renders a vertically scrolling column of images with animation.
 *
 * @param {Object} props - The properties object.
 * @param {ImageSourcePropType[]} props.images - An array of image sources to display in the scrolling column.
 * @param {number} props.speed - The speed of the scrolling animation in milliseconds.
 * @param {number} props.offset - An additional offset to apply to the initial vertical position.
 * @return The animated scrolling column component.
 */
function ScrollingColumn({
  images,
  speed,
  offset,
}: {
  images: ImageSourcePropType[];
  speed: number;
  offset: number;
}) {
  const translateY = useSharedValue(0);
  const setHeight = images.length * CARD_TOTAL;

  useEffect(() => {
    translateY.value = 0;
    translateY.value = withRepeat(
      withTiming(-setHeight, {
        duration: speed,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [translateY, setHeight, speed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + offset }],
  }));

  return (
    <Animated.View style={[styles.column, animatedStyle]}>
      {[0, 1].map((set) =>
        images.map((source, i) => (
          <Image
            key={`${set}-${i}`}
            source={source}
            style={styles.card}
          />
        )),
      )}
    </Animated.View>
  );
}

export default function GetStartedScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [col1, col2, col3] = useMemo(() => generateColumns(42), []);

  const handleGetStarted = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    bottomSheetRef.current?.expand();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Scrolling album art */}
      <View style={styles.cardsContainer}>
        <ScrollingColumn images={col1} speed={120000} offset={0} />
        <ScrollingColumn images={col2} speed={90000} offset={-CARD_TOTAL / 2} />
        <ScrollingColumn images={col3} speed={110000} offset={-CARD_TOTAL / 3} />
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

      <ConnectSheet ref={bottomSheetRef} />
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
