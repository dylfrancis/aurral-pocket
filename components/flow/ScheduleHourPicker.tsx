import { Platform, StyleSheet, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { getCalendars } from "expo-localization";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function uses24HourClock(): boolean {
  return getCalendars()[0]?.uses24hourClock ?? false;
}

function formatHour(hour: number, h24: boolean): string {
  if (h24) return `${String(hour).padStart(2, "0")}:00`;
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function parseHour(value: string): number {
  const match = /^(\d{1,2}):/.exec(String(value || "").trim());
  if (!match) return 0;
  return Math.max(0, Math.min(23, Number(match[1])));
}

function toHourString(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function ScheduleHourPicker({ value, onChange }: Props) {
  const colors = Colors[useColorScheme()];
  const selectedHour = parseHour(value);
  const h24 = uses24HourClock();

  return (
    <View style={styles.wrap}>
      <Text variant="body" style={[styles.label, { fontFamily: Fonts.medium }]}>
        Refresh hour
      </Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={selectedHour}
          onValueChange={(next) => onChange(toHourString(Number(next)))}
          itemStyle={[styles.item, { color: colors.text }]}
          accessibilityLabel="Refresh hour"
        >
          {HOURS.map((hour) => (
            <Picker.Item
              key={hour}
              label={formatHour(hour, h24)}
              value={hour}
              color={Platform.OS === "android" ? colors.text : undefined}
            />
          ))}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  label: {
    fontSize: 14,
  },
  pickerWrap: {
    height: Platform.OS === "ios" ? 140 : 50,
    justifyContent: "center",
  },
  item: {
    fontFamily: Fonts.regular,
    fontSize: 18,
  },
});
