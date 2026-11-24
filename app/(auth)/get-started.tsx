import { useEffect, useMemo } from "react";

import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { AurralLogo } from "@/components/AurralLogo";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { DiaText } from "@/components/ui/DiaText";
import { ConnectSheet } from "@/components/auth/ConnectSheet";
import { useSheet } from "@/components/ui/AppSheet";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

const CARD_GAP = 8;

const HEADLINE_VERBS = ["Discover", "Collect", "Stream"] as const;

// Maps number to padded filename at build time — Metro resolves each require statically.
const COVER_MAP: Record<number, ImageSourcePropType> = {
  1: require("@/assets/images/covers/01.jpg"),
  2: require("@/assets/images/covers/02.jpg"),
  3: require("@/assets/images/covers/03.jpg"),
  4: require("@/assets/images/covers/04.jpg"),
  5: require("@/assets/images/covers/05.jpg"),
  6: require("@/assets/images/covers/06.jpg"),
  7: require("@/assets/images/covers/07.jpg"),
  8: require("@/assets/images/covers/08.jpg"),
  9: require("@/assets/images/covers/09.jpg"),
  10: require("@/assets/images/covers/10.jpg"),
  11: require("@/assets/images/covers/11.jpg"),
  12: require("@/assets/images/covers/12.jpg"),
  13: require("@/assets/images/covers/13.jpg"),
  14: require("@/assets/images/covers/14.jpg"),
  15: require("@/assets/images/covers/15.jpg"),
  16: require("@/assets/images/covers/16.jpg"),
  17: require("@/assets/images/covers/17.jpg"),
  18: require("@/assets/images/covers/18.jpg"),
  19: require("@/assets/images/covers/19.jpg"),
  20: require("@/assets/images/covers/20.jpg"),
  21: require("@/assets/images/covers/21.jpg"),
  22: require("@/assets/images/covers/22.jpg"),
  23: require("@/assets/images/covers/23.jpg"),
  24: require("@/assets/images/covers/24.jpg"),
  25: require("@/assets/images/covers/25.jpg"),
  26: require("@/assets/images/covers/26.jpg"),
  27: require("@/assets/images/covers/27.jpg"),
  28: require("@/assets/images/covers/28.jpg"),
  29: require("@/assets/images/covers/29.jpg"),
  30: require("@/assets/images/covers/30.jpg"),
  31: require("@/assets/images/covers/31.jpg"),
  32: require("@/assets/images/covers/32.jpg"),
  33: require("@/assets/images/covers/33.jpg"),
  34: require("@/assets/images/covers/34.jpg"),
  35: require("@/assets/images/covers/35.jpg"),
  36: require("@/assets/images/covers/36.jpg"),
  37: require("@/assets/images/covers/37.jpg"),
  38: require("@/assets/images/covers/38.jpg"),
  39: require("@/assets/images/covers/39.jpg"),
  40: require("@/assets/images/covers/40.jpg"),
};
const COVERS: ImageSourcePropType[] = Object.values(COVER_MAP);

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

function generateColumns(seed: number): ImageSourcePropType[][] {
  const all = shuffled(COVERS, seed);
  const cols: ImageSourcePropType[][] = [[], [], []];
  all.forEach((img, i) => cols[i % 3].push(img));
  return cols;
}

function ScrollingColumn({
  images,
  speed,
  offset,
  cardSize,
}: {
  images: ImageSourcePropType[];
  speed: number;
  offset: number;
  cardSize: number;
}) {
  const translateY = useSharedValue(0);
  const cardTotal = cardSize + CARD_GAP;
  const setHeight = images.length * cardTotal;

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
    <Animated.View style={[{ width: cardSize, gap: CARD_GAP }, animatedStyle]}>
      {[0, 1].map((set) =>
        images.map((source, i) => (
          <Image
            key={`${set}-${i}`}
            source={source}
            style={{ width: cardSize, height: cardSize, borderRadius: 12 }}
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const connectSheet = useSheet();

  const cardSize = (screenWidth - 48) / 3;
  const cardTotal = cardSize + CARD_GAP;

  const [col1, col2, col3] = useMemo(() => generateColumns(42), []);

  const handleGetStarted = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    connectSheet.present();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Scrolling album art */}
      <View style={[styles.cardsContainer, { height: screenHeight * 0.65 }]}>
        <ScrollingColumn
          images={col1}
          speed={120000}
          offset={0}
          cardSize={cardSize}
        />
        <ScrollingColumn
          images={col2}
          speed={90000}
          offset={-cardTotal / 2}
          cardSize={cardSize}
        />
        <ScrollingColumn
          images={col3}
          speed={110000}
          offset={-cardTotal / 3}
          cardSize={cardSize}
        />
      </View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={[
          "transparent",
          colorScheme === "dark" ? "rgba(5,5,5,0.6)" : "rgba(245,244,241,0.6)",
          colors.background,
        ]}
        locations={[0, 0.3, 0.55]}
        style={[
          styles.gradient,
          { top: screenHeight * 0.3, height: screenHeight * 0.45 },
        ]}
      />

      {/* Content */}
      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <AurralLogo size={56} />
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${HEADLINE_VERBS[0]} music without the busywork.`}
          style={styles.headline}
        >
          <DiaText
            words={HEADLINE_VERBS}
            textStyle={[Fonts.bold, styles.headlineText]}
          />
          <Text variant="title" style={[styles.headlineText, styles.centered]}>
            {"music without\nthe busywork."}
          </Text>
        </View>
        <Text variant="subtitle" style={styles.subtext}>
          Your own server, in your pocket.
        </Text>
        <Button
          title="Get Started"
          onPress={handleGetStarted}
          style={styles.button}
        />
      </View>

      <ConnectSheet sheet={connectSheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: CARD_GAP,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  content: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  headline: {
    alignItems: "center",
    marginTop: 20,
  },
  headlineText: {
    fontSize: 32,
    lineHeight: 40,
  },
  centered: {
    textAlign: "center",
  },
  subtext: {
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    height: 54,
  },
});
