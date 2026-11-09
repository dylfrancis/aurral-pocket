import { memo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { FlowArtwork } from "@/components/flow/FlowArtwork";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

type Props = {
  name: string;
  uri: string | null;
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
  uri,
  size,
  radius,
}: Props) {
  const colors = Colors[useColorScheme()];
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showCover = !!uri && failedUri !== uri;

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
      {showCover ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onError={() => setFailedUri(uri)}
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
