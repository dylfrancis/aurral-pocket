import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { MIX_PRESETS } from "@/lib/types/flow";
import type { MixPercent } from "@/lib/types/flow";

type Props = {
  value: MixPercent;
  onPick: (mix: MixPercent) => void;
};

function isSamePreset(a: MixPercent, b: MixPercent): boolean {
  return (
    a.discover === b.discover && a.mix === b.mix && a.trending === b.trending
  );
}

export function MixPresetPicker({ value, onPick }: Props) {
  const colors = Colors[useColorScheme()];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {MIX_PRESETS.map((preset) => {
        const active = isSamePreset(preset.mix, value);
        return (
          <Pressable
            key={preset.id}
            onPress={() => onPick(preset.mix)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? colors.brand : colors.brandMuted,
                borderColor: active ? colors.brand : colors.separator,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: active ? colors.buttonPrimaryText : colors.brandStrong,
                fontFamily: Fonts.semiBold,
              }}
            >
              {preset.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
