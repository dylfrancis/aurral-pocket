import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { FlowArtwork } from "./FlowArtwork";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { getFlowArtworkSource } from "@/lib/api/flow";
import type { PlaylistStats } from "@/lib/types/flow";

type Props = {
  collection: {
    id: string;
    name: string;
    artworkRevision?: number;
    trackCount?: number;
  };
  kind: "flow" | "playlist";
  stats?: PlaylistStats;
  size: number;
  radius: number;
};

export function CollectionArtwork({
  collection,
  kind,
  stats,
  size,
  radius,
}: Props) {
  const colors = Colors[useColorScheme()];
  const { token } = useAuth();
  const artworkSource = getFlowArtworkSource(
    collection.id,
    token,
    collection.artworkRevision,
  );
  // Kept per URL: new artwork arrives under a new revision, so a new URL,
  // which starts unloaded and unfailed.
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const imageLoaded = loadedUri === artworkSource.uri;
  const imageFailed = failedUri === artworkSource.uri;

  // Retry a failed load when polling picks up new stats — the backend writes
  // the artwork when a flow first runs, so a stats change is a good signal
  // that the previously-404'd URL is now valid.
  const statsKey = stats
    ? `${stats.done}-${stats.total}`
    : `count-${collection.trackCount ?? 0}`;
  const [prevStatsKey, setPrevStatsKey] = useState(statsKey);
  if (prevStatsKey !== statsKey) {
    setPrevStatsKey(statsKey);
    setFailedUri(null);
  }

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: colors.separator,
        },
      ]}
    >
      <FlowArtwork
        name={collection.name}
        kind={kind}
        size={size}
        radius={radius}
      />
      {!imageFailed ? (
        <Image
          source={artworkSource}
          style={[StyleSheet.absoluteFill, { opacity: imageLoaded ? 1 : 0 }]}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onLoad={() => setLoadedUri(artworkSource.uri)}
          onError={() => setFailedUri(artworkSource.uri)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
