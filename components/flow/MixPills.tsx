import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { MixPercent } from "@/lib/types/flow";

const SOURCE_MIX_COLORS_LIGHT = {
  discover: "#5e7591",
  mix: "#8b6464",
  trending: "#6e8159",
  focus: "#7d6991",
} as const;

const SOURCE_MIX_COLORS_DARK = {
  discover: "#8a9eb8",
  mix: "#b78787",
  trending: "#94a578",
  focus: "#a78fbe",
} as const;

export function useSourceMixColors() {
  return useColorScheme() === "dark"
    ? SOURCE_MIX_COLORS_DARK
    : SOURCE_MIX_COLORS_LIGHT;
}

function MixPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text variant="caption" style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

type Props = {
  mix: MixPercent;
};

export function MixPills({ mix }: Props) {
  const palette = useSourceMixColors();
  const pills = [
    {
      label: `Discover ${mix.discover}%`,
      value: mix.discover,
      color: palette.discover,
    },
    { label: `Mix ${mix.mix}%`, value: mix.mix, color: palette.mix },
    {
      label: `Trend ${mix.trending}%`,
      value: mix.trending,
      color: palette.trending,
    },
    { label: `Focus ${mix.focus}%`, value: mix.focus, color: palette.focus },
  ];
  return (
    <View style={styles.row}>
      {pills
        .filter((pill) => pill.value > 0)
        .map((pill) => (
          <MixPill key={pill.label} label={pill.label} color={pill.color} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.semiBold,
    color: "#ffffff",
  },
});
