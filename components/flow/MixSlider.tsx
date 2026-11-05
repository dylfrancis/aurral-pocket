import { StyleSheet, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Text } from "@/components/ui/Text";
import { useSourceMixColors } from "./MixPills";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { MIX_SOURCES, type MixPercent, type MixSource } from "@/lib/types/flow";

const MIN_VALUE = 0;
const MAX_VALUE = 100;

const SOURCE_LABELS: Record<MixSource, string> = {
  discover: "Discover",
  mix: "Library Mix",
  trending: "Trending",
  focus: "Focus",
  newReleases: "New Releases",
};

type Props = {
  value: MixPercent;
  onChange: (value: MixPercent) => void;
};

function rebalance(
  current: MixPercent,
  source: MixSource,
  next: number,
): MixPercent {
  const clamped = Math.max(MIN_VALUE, Math.min(MAX_VALUE, Math.round(next)));
  const others = MIX_SOURCES.filter((other) => other !== source);
  const remaining = MAX_VALUE - clamped;
  const otherSum = others.reduce((acc, other) => acc + current[other], 0);
  // Rounding each share on its own can total 101, so floor them and give the
  // leftover points to the largest remainders.
  const parts = others.map((other) => {
    const exact =
      otherSum === 0
        ? remaining / others.length
        : (current[other] / otherSum) * remaining;
    return { source: other, share: Math.floor(exact), remainder: exact % 1 };
  });
  let leftover = remaining - parts.reduce((acc, part) => acc + part.share, 0);
  for (const part of [...parts].sort((a, b) => b.remainder - a.remainder)) {
    if (leftover <= 0) break;
    part.share += 1;
    leftover -= 1;
  }
  const result: MixPercent = { ...current, [source]: clamped };
  for (const part of parts) result[part.source] = part.share;
  return result;
}

export function MixSlider({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {MIX_SOURCES.map((source) => (
        <SingleSlider
          key={source}
          source={source}
          label={SOURCE_LABELS[source]}
          value={value[source]}
          onChange={(next) => onChange(rebalance(value, source, next))}
        />
      ))}
    </View>
  );
}

function SingleSlider({
  source,
  label,
  value,
  onChange,
}: {
  source: MixSource;
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const colors = Colors[useColorScheme()];
  const palette = useSourceMixColors();
  const accent = palette[source];

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text variant="body" style={{ ...Fonts.medium }}>
          {label}
        </Text>
        <Text variant="body" style={[styles.value, { color: accent }]}>
          {Math.round(value)}%
        </Text>
      </View>
      <Slider
        value={value}
        minimumValue={MIN_VALUE}
        maximumValue={MAX_VALUE}
        step={1}
        minimumTrackTintColor={accent}
        maximumTrackTintColor={colors.separator}
        thumbTintColor={accent}
        onValueChange={onChange}
        accessibilityLabel={`${label} percentage`}
        accessibilityValue={{
          min: MIN_VALUE,
          max: MAX_VALUE,
          now: value,
          text: `${Math.round(value)} percent`,
        }}
        testID={`mix-slider-${source}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  row: {
    gap: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  value: {
    ...Fonts.semiBold,
  },
});
