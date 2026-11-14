import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { MIX_PRESETS, MIX_SOURCES } from "@/lib/types/flow";
import type { MixPercent } from "@/lib/types/flow";
import { useColors } from "@/hooks/use-colors";

type Props = {
  value: MixPercent;
  onPick: (mix: MixPercent) => void;
};

function isSamePreset(a: MixPercent, b: MixPercent): boolean {
  return MIX_SOURCES.every((source) => a[source] === b[source]);
}

export function MixPresetPicker({ value, onPick }: Props) {
  const colors = useColors();

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
                ...Fonts.semiBold,
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
