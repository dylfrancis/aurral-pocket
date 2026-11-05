import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image, type ImageStyle } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCoverArtUrl } from "@/hooks/library/use-cover-art-url";
import { serverImageSource } from "@/lib/api/client";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import type { CoverArtType } from "@/lib/types/library";

type CoverArtImageProps = {
  type: CoverArtType;
  mbid: string;
  size: number | "fill";
  style?: ImageStyle;
  borderRadius?: number;
  blurRadius?: number;
  /**
   * The path the server serves this record's artwork from, such as an
   * album's `coverUrl`. When set, the image loads from it and the MBID
   * lookup is skipped: one request to the server instead of a lookup and a
   * download from the cover provider.
   */
  coverUrl?: string | null;
};

export function CoverArtImage({
  type,
  mbid,
  size,
  style,
  borderRadius = 8,
  blurRadius,
  coverUrl,
}: CoverArtImageProps) {
  // The image URLs that failed for this record. A list cell is recycled for
  // another record, so failures are kept per record.
  const record = `${type}:${coverUrl ?? ""}:${mbid}`;
  const [failures, setFailures] = useState({ record, uris: [] as string[] });
  const failedUris = failures.record === record ? failures.uris : [];

  // The server answers 404 for a record it has no artwork for. The image then
  // falls back to the MBID lookup the screens without a server path use.
  const serverSource = coverUrl ? serverImageSource(coverUrl) : null;
  const useServer = !!serverSource && !failedUris.includes(serverSource.uri);
  const lookup = useCoverArtUrl({ type, mbid: useServer ? undefined : mbid });
  const source = useServer
    ? serverSource
    : lookup.url
      ? { uri: lookup.url }
      : null;
  const isLoading = !useServer && lookup.isLoading;
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
            setFailures({ record, uris: [...failedUris, source.uri] })
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
