import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Image, type ImageStyle } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCoverArtUrl } from "@/hooks/library/use-cover-art-url";
import {
  imageSource,
  serverImageSource,
  type ServerImageSource,
} from "@/lib/api/client";
import type { AlbumCoverHints } from "@/lib/api/library";
import type { CoverArtType } from "@/lib/types/library";
import { fullSizeCoverUrl } from "@/lib/url";
import { useColors } from "@/hooks/use-colors";

type CoverArtImageProps = {
  type: CoverArtType;
  mbid: string;
  size: number | "fill";
  style?: ImageStyle;
  /** Defaults to a circle for artists and to 8 for everything else. */
  borderRadius?: number;
  blurRadius?: number;
  /**
   * A server artwork path, such as an album's `coverUrl`. Loaded instead of
   * the MBID lookup, which runs only if it fails. An archive thumbnail that
   * fails gets its full-size original tried first.
   */
  coverUrl?: string | null;
  hints?: AlbumCoverHints;
  /** Drawn in place of the placeholder when no image loads. */
  fallback?: ReactNode;
};

export function CoverArtImage({
  type,
  mbid,
  size,
  style,
  borderRadius: borderRadiusProp,
  blurRadius,
  coverUrl,
  hints,
  fallback,
}: CoverArtImageProps) {
  // React Native caps a radius at half the side, so a "fill" image is round
  // too.
  const borderRadius =
    borderRadiusProp ?? (type === "artist" ? CIRCLE_RADIUS : 8);
  // Kept per record, because list cells are recycled for other records.
  const recordKey = `${type}:${coverUrl ?? ""}:${mbid}`;
  const [failures, setFailures] = useState({ recordKey, uris: [] as string[] });
  const failedUris = failures.recordKey === recordKey ? failures.uris : [];

  const firstUnfailed = (first: ServerImageSource | null) =>
    withFullSize(first).find(({ uri }) => !failedUris.includes(uri)) ?? null;

  const serverSource = firstUnfailed(
    coverUrl ? serverImageSource(coverUrl) : null,
  );
  const mbidLookup = useCoverArtUrl({
    type,
    mbid: serverSource ? undefined : mbid,
    hints,
  });
  const source =
    serverSource ??
    firstUnfailed(mbidLookup.url ? imageSource(mbidLookup.url) : null);
  const isLoading = !serverSource && mbidLookup.isLoading;

  const colors = useColors();
  const recyclingKey = source?.uri ?? `${type}-${mbid}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loaded = loadedKey === recyclingKey;

  const sizeStyle =
    size === "fill"
      ? { width: "100%" as const, aspectRatio: 1 }
      : { width: size, height: size };

  if (!isLoading && !source) {
    if (fallback) return fallback;
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

/** A source, then its full-size original when it is a sized archive thumbnail. */
function withFullSize(source: ServerImageSource | null): ServerImageSource[] {
  if (!source) return [];
  const original = fullSizeCoverUrl(source.uri);
  return original === source.uri ? [source] : [source, imageSource(original)];
}

const CIRCLE_RADIUS = 9999;

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
});
