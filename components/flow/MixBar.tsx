import { StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { useSourceMixColors } from "./MixPills";
import type { MixPercent } from "@/lib/types/flow";

type Props = {
  mix: MixPercent;
  height?: number;
};

export function MixBar({ mix, height = 6 }: Props) {
  const colors = Colors[useColorScheme()];
  const palette = useSourceMixColors();
  const total = Math.max(1, mix.discover + mix.mix + mix.trending + mix.focus);

  const segments = [
    { key: "discover", value: mix.discover, color: colors.brand },
    { key: "mix", value: mix.mix, color: colors.brandStrong },
    { key: "trending", value: mix.trending, color: colors.subtle },
    { key: "focus", value: mix.focus, color: palette.focus },
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
