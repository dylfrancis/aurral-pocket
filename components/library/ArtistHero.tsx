import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "./CoverArtImage";
import { LibraryBadge } from "./LibraryBadge";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { Artist } from "@/lib/types/library";

const SCREEN_WIDTH = Dimensions.get("window").width;

type ArtistHeroProps = {
  artist: Pick<Artist, "mbid" | "artistName">;
  scrollY?: SharedValue<number>;
  refreshing?: boolean;
  inLibrary: boolean;
  onBadgePress?: () => void;
  onAddPress?: () => void;
};

export function ArtistHero({
  artist,
  scrollY,
  refreshing,
  inLibrary,
  onBadgePress,
  onAddPress,
}: ArtistHeroProps) {
  const colors = Colors[useColorScheme()];

  const backgroundStyle = useAnimatedStyle(() => {
    const offset = scrollY?.value ?? 0;
    if (offset >= 0) return {};
    const scale = 1 + Math.abs(offset) / SCREEN_WIDTH;
    return {
      transform: [{ scale }, { translateY: offset / 2 }],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.background, backgroundStyle]}>
        <CoverArtImage
          type="artist"
          mbid={artist.mbid}
          size={SCREEN_WIDTH}
          borderRadius={0}
          blurRadius={25}
        />
      </Animated.View>
      {refreshing && (
        <View style={styles.refreshIndicator}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
      <LinearGradient
        colors={["transparent", colors.background]}
        style={styles.gradient}
      />
      <View style={styles.foreground}>
        <View style={styles.spacer} />
        <CoverArtImage
          type="artist"
          mbid={artist.mbid}
          size={200}
          borderRadius={100}
        />
        <Text variant="title" style={styles.name}>
          {artist.artistName}
        </Text>
        {inLibrary
          ? onBadgePress && <LibraryBadge onPress={onBadgePress} />
          : onAddPress && (
              <Pressable
                onPress={onAddPress}
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text variant="body" style={styles.addButtonText}>
                  Add to Library
                </Text>
              </Pressable>
            )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    minHeight: SCREEN_WIDTH,
    position: "relative",
  },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_WIDTH,
  },
  foreground: {
    alignItems: "center",
    paddingBottom: 24,
    gap: 8,
  },
  spacer: {
    height: SCREEN_WIDTH - 300,
  },
  refreshIndicator: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  name: {
    textAlign: "center",
    paddingHorizontal: 24,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  addButtonText: {
    color: "#fff",
    fontFamily: Fonts.semiBold,
  },
});
