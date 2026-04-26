import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

const DAYS: { value: number; label: string }[] = [
  { value: 0, label: "S" },
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
];

type Props = {
  value: number[];
  onChange: (next: number[]) => void;
};

export function ScheduleDayPicker({ value, onChange }: Props) {
  const colors = Colors[useColorScheme()];
  const selected = new Set(value);

  const toggle = (day: number) => {
    const next = new Set(selected);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    onChange([...next].sort((a, b) => a - b));
  };

  return (
    <View style={styles.row}>
      {DAYS.map((day) => {
        const active = selected.has(day.value);
        return (
          <Pressable
            key={day.value}
            onPress={() => toggle(day.value)}
            style={({ pressed }) => [
              styles.dot,
              {
                backgroundColor: active ? colors.brand : colors.inputBackground,
                borderColor: active ? colors.brand : colors.inputBorder,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityLabel={`Toggle day ${day.value}`}
          >
            <Text
              variant="body"
              style={{
                color: active ? colors.buttonPrimaryText : colors.text,
                fontFamily: Fonts.semiBold,
              }}
            >
              {day.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dot: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
