import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { CircleButton } from "@/components/ui/CircleButton";
import { PLAY_ROW_HEIGHT, PlayRow } from "@/components/ui/PlayRow";
import { PlayRowSkeleton } from "@/components/ui/PlayRowSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "./CoverArtImage";
import { Fonts, Radius } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import { formatCompactCount } from "@/lib/discover/trending-format";
import type { Artist } from "@/lib/types/library";
import { useColors } from "@/hooks/use-colors";
import { useSidePadding } from "@/hooks/use-side-insets";

const CAPSULE_PLACEHOLDER = { width: 196, height: 28 };

type ArtistHeroProps = {
  artist: Pick<Artist, "mbid" | "artistName" | "coverUrl">;
  /** Shown under the name. Omitted while the artist loads or with no count. */
  listeners?: number | null;
  scrollY?: SharedValue<number>;
  refreshing?: boolean;
  inLibrary: boolean | undefined;
  onAddPress?: () => void;
  /** Library artists only: the In Library capsule. */
  libraryControl?: ReactNode;
  /** Library artists only: Play and Shuffle for all of the artist's tracks. */
  play?: { disabled: boolean; onPlay: () => void; onShuffle: () => void };
  /** Library artists only. Omit when the artist can't be favorited. */
  favorite?: { active: boolean; onToggle: () => void };
};

export function ArtistHero({
  artist,
  listeners,
  scrollY,
  refreshing,
  inLibrary,
  onAddPress,
  libraryControl,
  play,
  favorite,
}: ArtistHeroProps) {
  const colors = useColors();
  // The photo spans the window, under the side rail; the name and buttons
  // stay beside it.
  const { width } = useWindowDimensions();
  const sidePadding = useSidePadding();

  const backgroundStyle = useAnimatedStyle(() => {
    const offset = scrollY?.value ?? 0;
    if (offset >= 0) return {};
    const scale = 1 + Math.abs(offset) / width;
    return {
      transform: [{ scale }, { translateY: offset / 2 }],
    };
  });

  return (
    <View style={[styles.container, { width, minHeight: width }]}>
      <Animated.View style={[styles.background, backgroundStyle]}>
        <CoverArtImage
          type="artist"
          mbid={artist.mbid}
          coverUrl={artist.coverUrl}
          size={width}
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
        style={[styles.gradient, { height: width }]}
      />
      <View
        style={[
          styles.foreground,
          inLibrary !== false && styles.foregroundPlay,
          sidePadding,
        ]}
      >
        <View style={IS_IOS ? { height: width - 300 } : styles.spacerAndroid} />
        <CoverArtImage
          type="artist"
          mbid={artist.mbid}
          coverUrl={artist.coverUrl}
          size={200}
        />
        <View style={styles.nameBlock}>
          <Text variant="title" style={styles.name}>
            {artist.artistName}
          </Text>
          {listeners ? (
            <Text variant="caption" style={{ color: colors.subtle }}>
              {formatCompactCount(listeners)}{" "}
              {listeners === 1 ? "listener" : "listeners"}
            </Text>
          ) : null}
        </View>
        {inLibrary === undefined ? (
          // A Library artist's capsule and Play row, the likelier case.
          <>
            <Skeleton
              width={CAPSULE_PLACEHOLDER.width}
              height={CAPSULE_PLACEHOLDER.height}
              borderRadius={Radius.round}
            />
            <PlayRowSkeleton />
          </>
        ) : inLibrary ? (
          <>
            {libraryControl}
            {play && (
              <PlayRow
                title={artist.artistName}
                disabled={play.disabled}
                onPlay={play.onPlay}
                onShuffle={play.onShuffle}
              >
                {/* The spacer keeps Play centered when the artist can't be
                    favorited. */}
                {favorite ? (
                  <CircleButton
                    icon={favorite.active ? "heart" : "heart-outline"}
                    size={PLAY_ROW_HEIGHT}
                    accessibilityLabel={
                      favorite.active
                        ? `Remove ${artist.artistName} from favorites`
                        : `Add ${artist.artistName} to favorites`
                    }
                    onPress={favorite.onToggle}
                  />
                ) : (
                  <View style={styles.circleSpacer} />
                )}
              </PlayRow>
            )}
          </>
        ) : (
          onAddPress && (
            <Pressable
              onPress={onAddPress}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="add" size={18} color={colors.buttonPrimaryText} />
              <Text
                variant="body"
                style={[
                  styles.addButtonText,
                  { color: colors.buttonPrimaryText },
                ]}
              >
                Add to Library
              </Text>
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  },
  foreground: {
    alignItems: "center",
    paddingBottom: 24,
    gap: 8,
  },
  // The Play row brings its own padding.
  foregroundPlay: {
    paddingBottom: 0,
  },
  circleSpacer: {
    width: PLAY_ROW_HEIGHT,
    height: PLAY_ROW_HEIGHT,
  },
  spacerAndroid: {
    height: 16,
  },
  refreshIndicator: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  nameBlock: {
    alignItems: "center",
    gap: 2,
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
    ...Fonts.semiBold,
  },
});
