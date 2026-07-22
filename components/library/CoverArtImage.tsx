import { Skeleton } from "@/components/ui/Skeleton";
import { Colors } from "@/constants/theme";
import { useCoverArtUrl } from "@/hooks/library/use-cover-art-url";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { CoverArtType } from "@/lib/types/library";
import { Ionicons } from "@expo/vector-icons";
import { Image, type ImageStyle } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

type CoverArtImageProps = {
  type: CoverArtType;
  mbid: string;
  size: number | "fill";
  style?: ImageStyle;
  borderRadius?: number;
  blurRadius?: number;
  imageUrl?: string | null;
};

export function CoverArtImage({
  type,
  mbid,
  size,
  style,
  borderRadius = 8,
  blurRadius,
  imageUrl,
}: CoverArtImageProps) {
  const { url, isLoading } = useCoverArtUrl({
    type,
    mbid,
    providedUrl: imageUrl,
  });
  const colors = Colors[useColorScheme()];
  const recyclingKey = `${type}-${mbid}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loaded = loadedKey === recyclingKey;

  const sizeStyle =
    size === "fill"
      ? { width: "100%" as const, aspectRatio: 1 }
      : { width: size, height: size };

  if (!isLoading && !url) {
    return (
      <View
        style={[
          styles.placeholder,
          sizeStyle,
          { borderRadius, backgroundColor: colors.card },
          style,
        ]}
      >
        <Ionicons
          name="musical-notes-outline"
          size={size === "fill" ? 48 : size * 0.35}
          color={colors.brand}
        />
      </View>
    );
  }

  return (
    <View style={[sizeStyle, { borderRadius, overflow: "hidden" }, style]}>
      {!loaded && (
        <Skeleton
          width="100%"
          height={0}
          borderRadius={borderRadius}
          style={StyleSheet.absoluteFill}
        />
      )}
      {url && (
        <Image
          source={{ uri: url }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          contentFit="cover"
          transition={200}
          blurRadius={blurRadius}
          recyclingKey={recyclingKey}
          onLoad={() => setLoadedKey(recyclingKey)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
});
