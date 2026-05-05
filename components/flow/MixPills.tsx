import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { MixPercent } from "@/lib/types/flow";

const SOURCE_MIX_COLORS_LIGHT = {
  discover: "#5e7591",
  mix: "#8b6464",
  trending: "#6e8159",
} as const;

const SOURCE_MIX_COLORS_DARK = {
  discover: "#8a9eb8",
  mix: "#b78787",
  trending: "#94a578",
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
  return (
    <View style={styles.row}>
      <MixPill label={`Discover ${mix.discover}%`} color={palette.discover} />
      <MixPill label={`Mix ${mix.mix}%`} color={palette.mix} />
      <MixPill label={`Trend ${mix.trending}%`} color={palette.trending} />
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
