import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image, type ImageStyle } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCoverArtUrl } from "@/hooks/library/use-cover-art-url";
import { serverImageSource } from "@/lib/api/client";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import type { AlbumCoverHints } from "@/lib/api/library";
import type { CoverArtType } from "@/lib/types/library";

type CoverArtImageProps = {
  type: CoverArtType;
  mbid: string;
  size: number | "fill";
  style?: ImageStyle;
  borderRadius?: number;
  blurRadius?: number;
  /**
   * A server artwork path, such as an album's `coverUrl`. Loaded instead of
   * the MBID lookup, which runs only if it fails.
   */
  coverUrl?: string | null;
  hints?: AlbumCoverHints;
};

export function CoverArtImage({
  type,
  mbid,
  size,
  style,
  borderRadius = 8,
  blurRadius,
  coverUrl,
  hints,
}: CoverArtImageProps) {
  // Kept per record, because list cells are recycled for other records.
  const recordKey = `${type}:${coverUrl ?? ""}:${mbid}`;
  const [failures, setFailures] = useState({ recordKey, uris: [] as string[] });
  const failedUris = failures.recordKey === recordKey ? failures.uris : [];

  const serverSource = coverUrl ? serverImageSource(coverUrl) : null;
  const loadFromServer =
    !!serverSource && !failedUris.includes(serverSource.uri);
  const mbidLookup = useCoverArtUrl({
    type,
    mbid: loadFromServer ? undefined : mbid,
    hints,
  });
  const source = loadFromServer
    ? serverSource
    : mbidLookup.url
      ? { uri: mbidLookup.url }
      : null;
  const isLoading = !loadFromServer && mbidLookup.isLoading;
  const failed = !!source && failedUris.includes(source.uri);

  const colors = Colors[useColorScheme()];
  const recyclingKey = source?.uri ?? `${type}-${mbid}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loaded = loadedKey === recyclingKey;

  const sizeStyle =
    size === "fill"
      ? { width: "100%" as const, aspectRatio: 1 }
      : { width: size, height: size };

  if ((!isLoading && !source) || failed) {
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
      {source && (
        <Image
          source={source}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          contentFit="cover"
          transition={200}
          blurRadius={blurRadius}
          recyclingKey={recyclingKey}
          onLoad={() => setLoadedKey(recyclingKey)}
          onError={() =>
            setFailures({ recordKey, uris: [...failedUris, source.uri] })
          }
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
