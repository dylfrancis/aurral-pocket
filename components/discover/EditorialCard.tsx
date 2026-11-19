import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Fonts, Radius } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { EditorialArtwork } from "./EditorialArtwork";

const PLAY_BUTTON_SIZE = 36;

type Props = {
  name: string;
  caption: string;
  artworkUrl: string | null;
  size: number;
  onPress: () => void;
  /** Draws a ▶ on the cover that plays the playlist without opening it. */
  onPlay?: () => void;
  /** The playlist is loading for its ▶: the button becomes a spinner. */
  playLoading?: boolean;
};

/** A playlist's or a Browse category's cover with its name underneath. */
export function EditorialCard({
  name,
  caption,
  artworkUrl,
  size,
  onPress,
  onPlay,
  playLoading = false,
}: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      onPress={onPress}
      style={({ pressed }) => ({ width: size, opacity: pressed ? 0.7 : 1 })}
    >
      <View>
        <EditorialArtwork
          name={name}
          coverUrl={artworkUrl}
          size={size}
          radius={10}
        />
        {onPlay ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play ${name}`}
            disabled={playLoading}
            hitSlop={6}
            onPress={onPlay}
            style={({ pressed }) => [
              styles.playButton,
              { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {playLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.buttonPrimaryText}
              />
            ) : (
              <Ionicons
                name="play"
                size={16}
                color={colors.buttonPrimaryText}
                style={styles.playIcon}
              />
            )}
          </Pressable>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text variant="body" numberOfLines={1} style={styles.title}>
          {name}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  playButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
    borderRadius: Radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  // The triangle's weight sits left of its box, so it's nudged to look
  // centered.
  playIcon: {
    marginLeft: 2,
  },
  info: {
    paddingTop: 8,
    gap: 2,
  },
  title: {
    ...Fonts.semiBold,
  },
});
