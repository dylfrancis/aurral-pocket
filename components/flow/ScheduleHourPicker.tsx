import { StyleSheet, View } from "react-native";
import { getCalendars } from "expo-localization";
import { MenuPicker } from "@/components/ui/MenuPicker";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";

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
  const h24 = uses24HourClock();
  const options = HOURS.map((hour) => ({
    value: toHourString(hour),
    label: formatHour(hour, h24),
  }));

  return (
    <View style={styles.row}>
      <Text variant="body" style={styles.label}>
        Refresh hour
      </Text>
      <MenuPicker
        accessibilityLabel="Refresh hour"
        // A saved time off the hour, such as "07:30", shows as its hour.
        value={toHourString(parseHour(value))}
        options={options}
        onChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 44,
  },
  label: {
    ...Fonts.medium,
    fontSize: 14,
    flexShrink: 1,
  },
});
