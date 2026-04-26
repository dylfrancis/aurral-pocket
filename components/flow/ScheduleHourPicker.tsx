import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const HOURS = Array.from(
  { length: 24 },
  (_, i) => `${String(i).padStart(2, "0")}:00`,
);

function format12h(hour: string): string {
  const h = Number(hour.slice(0, 2));
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

export function ScheduleHourPicker({ value, onChange }: Props) {
  const colors = Colors[useColorScheme()];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {HOURS.map((hour) => {
        const active = hour === value;
        return (
          <Pressable
            key={hour}
            onPress={() => onChange(hour)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? colors.brand : colors.inputBackground,
                borderColor: active ? colors.brand : colors.inputBorder,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: active ? colors.buttonPrimaryText : colors.text,
                fontFamily: Fonts.semiBold,
              }}
            >
              {format12h(hour)}
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
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
