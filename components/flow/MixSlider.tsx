import { StyleSheet, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Text } from "@/components/ui/Text";
import { useSourceMixColors } from "./MixPills";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { MixPercent } from "@/lib/types/flow";

const MIN_VALUE = 0;
const MAX_VALUE = 100;

type Channel = keyof MixPercent;

const CHANNEL_ORDER: Channel[] = ["discover", "mix", "trending"];
const CHANNEL_LABELS: Record<Channel, string> = {
  discover: "Discover",
  mix: "Library Mix",
  trending: "Trending",
};

type Props = {
  value: MixPercent;
  onChange: (value: MixPercent) => void;
};

function rebalance(
  current: MixPercent,
  channel: Channel,
  next: number,
): MixPercent {
  const clamped = Math.max(MIN_VALUE, Math.min(MAX_VALUE, Math.round(next)));
  const others = CHANNEL_ORDER.filter((c) => c !== channel);
  const remaining = MAX_VALUE - clamped;
  const otherSum = others.reduce((acc, c) => acc + current[c], 0);
  const result: MixPercent = { ...current, [channel]: clamped };
  if (otherSum === 0) {
    const split = Math.floor(remaining / others.length);
    others.forEach((c, idx) => {
      result[c] = idx === others.length - 1 ? remaining - split * idx : split;
    });
  } else {
    let assigned = 0;
    others.forEach((c, idx) => {
      const share =
        idx === others.length - 1
          ? remaining - assigned
          : Math.round((current[c] / otherSum) * remaining);
      result[c] = Math.max(0, share);
      assigned += result[c];
    });
  }
  const sum = result.discover + result.mix + result.trending;
  if (sum !== MAX_VALUE) {
    const diff = MAX_VALUE - sum;
    result[others[0]] = Math.max(0, result[others[0]] + diff);
  }
  return result;
}

export function MixSlider({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {CHANNEL_ORDER.map((channel) => (
        <SingleSlider
          key={channel}
          channel={channel}
          label={CHANNEL_LABELS[channel]}
          value={value[channel]}
          onChange={(next) => onChange(rebalance(value, channel, next))}
        />
      ))}
    </View>
  );
}

function SingleSlider({
  channel,
  label,
  value,
  onChange,
}: {
  channel: Channel;
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const colors = Colors[useColorScheme()];
  const palette = useSourceMixColors();
  const accent = palette[channel];

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text variant="body" style={{ fontFamily: Fonts.medium }}>
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
        testID={`mix-slider-${channel}`}
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
    fontFamily: Fonts.semiBold,
  },
});
