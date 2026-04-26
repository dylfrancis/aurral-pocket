import { StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import type { MixPercent } from "@/lib/types/flow";

type Props = {
  mix: MixPercent;
  height?: number;
};

export function MixBar({ mix, height = 6 }: Props) {
  const colors = Colors[useColorScheme()];
  const total = Math.max(1, mix.discover + mix.mix + mix.trending);

  const segments = [
    { key: "discover", value: mix.discover, color: colors.brand },
    { key: "mix", value: mix.mix, color: colors.brandStrong },
    { key: "trending", value: mix.trending, color: colors.subtle },
  ];

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: colors.separator },
      ]}
    >
      {segments.map((segment) => (
        <View
          key={segment.key}
          style={{
            flex: segment.value / total,
            backgroundColor: segment.color,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    overflow: "hidden",
    width: "100%",
  },
});
