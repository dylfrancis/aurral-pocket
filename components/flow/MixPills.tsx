import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { MIX_SOURCES, type MixPercent, type MixSource } from "@/lib/types/flow";

const SOURCE_MIX_COLORS_LIGHT = {
  discover: "#5e7591",
  mix: "#8b6464",
  trending: "#66794f",
  focus: "#7d6991",
  newReleases: "#86704d",
} as const;

const SOURCE_MIX_COLORS_DARK = {
  discover: "#8a9eb8",
  mix: "#b78787",
  trending: "#94a578",
  focus: "#a78fbe",
  newReleases: "#b0946c",
} as const;

const PILL_LABELS: Record<MixSource, string> = {
  discover: "Discover",
  mix: "Mix",
  trending: "Trend",
  focus: "Focus",
  newReleases: "New Releases",
};

const PILL_LABEL_COLOR = { light: "#ffffff", dark: "#000000" } as const;

export function useSourceMixColors() {
  return useColorScheme() === "dark"
    ? SOURCE_MIX_COLORS_DARK
    : SOURCE_MIX_COLORS_LIGHT;
}

function MixPill({
  label,
  fill,
  labelColor,
}: {
  label: string;
  fill: string;
  labelColor: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: fill }]}>
      <Text variant="caption" style={[styles.label, { color: labelColor }]}>
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
  const labelColor = PILL_LABEL_COLOR[useColorScheme()];
  return (
    <View style={styles.row}>
      {MIX_SOURCES.filter((source) => mix[source] > 0).map((source) => (
        <MixPill
          key={source}
          label={`${PILL_LABELS[source]} ${mix[source]}%`}
          fill={palette[source]}
          labelColor={labelColor}
        />
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
    ...Fonts.semiBold,
  },
});
