import { memo } from "react";
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
 * Generated art shows until the cover loads, and stays if it fails. Memoized
 * because it's an SVG and the playlist page re-renders on every playback tick.
 */
export const EditorialArtwork = memo(function EditorialArtwork({
  name,
  uri,
  size,
  radius,
}: Props) {
  const colors = Colors[useColorScheme()];

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
      <FlowArtwork name={name} kind="playlist" size={size} radius={radius} />
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
