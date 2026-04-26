import { useCallback } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { Text } from "@/components/ui/Text";
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
  let result: MixPercent = { ...current, [channel]: clamped };
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
          label={CHANNEL_LABELS[channel]}
          value={value[channel]}
          onChange={(next) => onChange(rebalance(value, channel, next))}
        />
      ))}
    </View>
  );
}

function SingleSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const colors = Colors[useColorScheme()];
  const trackWidth = useSharedValue(0);
  const progress = useSharedValue(value);

  const updateLayout = useCallback(
    (event: LayoutChangeEvent) => {
      trackWidth.value = event.nativeEvent.layout.width;
    },
    [trackWidth],
  );

  // Sync incoming prop changes (e.g. from preset taps)
  if (progress.value !== value) {
    progress.value = value;
  }

  const setValue = useCallback(
    (next: number) => {
      const clamped = Math.max(MIN_VALUE, Math.min(MAX_VALUE, next));
      onChange(clamped);
    },
    [onChange],
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      const w = trackWidth.value;
      if (w > 0) {
        const ratio = event.x / w;
        const next = Math.round(ratio * MAX_VALUE);
        progress.value = next;
        runOnJS(setValue)(next);
      }
    })
    .onUpdate((event) => {
      const w = trackWidth.value;
      if (w > 0) {
        const ratio = event.x / w;
        const next = Math.max(
          0,
          Math.min(MAX_VALUE, Math.round(ratio * MAX_VALUE)),
        );
        progress.value = next;
        runOnJS(setValue)(next);
      }
    });

  const fillStyle = useAnimatedStyle(() => {
    const ratio = progress.value / MAX_VALUE;
    return {
      width: `${Math.max(0, Math.min(100, ratio * 100))}%`,
    };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const ratio = progress.value / MAX_VALUE;
    return {
      left: `${Math.max(0, Math.min(100, ratio * 100))}%`,
    };
  });

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text variant="body" style={{ fontFamily: Fonts.medium }}>
          {label}
        </Text>
        <Text
          variant="body"
          style={[styles.value, { color: colors.brandStrong }]}
        >
          {Math.round(value)}%
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={[styles.track, { backgroundColor: colors.separator }]}
          onLayout={updateLayout}
        >
          <Animated.View
            style={[styles.fill, { backgroundColor: colors.brand }, fillStyle]}
          />
          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.brand,
              },
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
  },
  row: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  value: {
    fontFamily: Fonts.semiBold,
  },
  track: {
    height: 8,
    borderRadius: 4,
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    transform: [{ translateX: -11 }],
    top: -7,
  },
});
