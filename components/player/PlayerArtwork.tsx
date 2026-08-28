import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type PlayerArtworkProps = {
  url: string | null;
  size: number | "fill";
  borderRadius?: number;
};

/**
 * Artwork for a queued track, straight from its URL. Queue items carry the
 * album art URL already resolved, so this skips the cover-art lookup that
 * CoverArtImage does for library entities.
 */
export function PlayerArtwork({
  url,
  size,
  borderRadius = 8,
}: PlayerArtworkProps) {
  const colors = Colors[useColorScheme()];
  const sizeStyle =
    size === "fill"
      ? { width: "100%" as const, aspectRatio: 1 }
      : { width: size, height: size };

  if (!url) {
    return (
      <View
        style={[
          styles.placeholder,
          sizeStyle,
          { borderRadius, backgroundColor: colors.card },
        ]}
      >
        <Ionicons
          name="musical-notes-outline"
          size={size === "fill" ? 48 : size * 0.5}
          color={colors.brand}
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      style={[sizeStyle, { borderRadius }]}
      contentFit="cover"
      transition={150}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
