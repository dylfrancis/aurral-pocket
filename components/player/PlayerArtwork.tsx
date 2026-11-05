import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { serverImageSource } from "@/lib/api/client";

type PlayerArtworkProps = {
  url: string | null;
  /** The cover on the server. Loaded instead of `url`, which is its fallback. */
  coverPath?: string | null;
  size: number | "fill";
  borderRadius?: number;
};

/**
 * Artwork for a queued track. Queue items carry the image already resolved, so
 * this skips the cover-art lookup that CoverArtImage does for library entities.
 */
export function PlayerArtwork({
  url,
  coverPath,
  size,
  borderRadius = 8,
}: PlayerArtworkProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const serverSource = serverImageSource(coverPath);
  const source =
    serverSource && serverSource.uri !== failedUri
      ? serverSource
      : url
        ? { uri: url }
        : null;
  const colors = Colors[useColorScheme()];
  const sizeStyle =
    size === "fill"
      ? { width: "100%" as const, aspectRatio: 1 }
      : { width: size, height: size };

  if (!source) {
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
      source={source}
      style={[sizeStyle, { borderRadius }]}
      contentFit="cover"
      transition={150}
      onError={() => {
        if (source === serverSource) setFailedUri(serverSource.uri);
      }}
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
