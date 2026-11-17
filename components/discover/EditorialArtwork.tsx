import { memo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { FlowArtwork } from "@/components/flow/FlowArtwork";
import { serverImageSource } from "@/lib/api/client";
import { useColors } from "@/hooks/use-colors";

type Props = {
  name: string;
  coverUrl: string | null;
  size: number;
  radius: number;
};

/**
 * No generated art under a cover: an SVG behind every cover froze the UI thread
 * when the Playlists tab opened. Memoized because the playlist page re-renders
 * on every playback tick.
 */
export const EditorialArtwork = memo(function EditorialArtwork({
  name,
  coverUrl,
  size,
  radius,
}: Props) {
  const colors = useColors();
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const source =
    failedCoverUrl === coverUrl ? null : serverImageSource(coverUrl);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: colors.separator,
          backgroundColor: colors.card,
        },
      ]}
    >
      {source ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onError={() => setFailedCoverUrl(coverUrl)}
        />
      ) : (
        <FlowArtwork name={name} kind="playlist" size={size} radius={radius} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
