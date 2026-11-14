import { Picker } from "@expo/ui";
import type { SettingsPickerProps } from "@/components/settings/settings-controls";

/** SwiftUI's menu picker, as iOS Settings draws a choice in a row. */
export function SettingsPicker({
  accessibilityLabel,
  value,
  options,
  onChange,
}: SettingsPickerProps) {
  return (
    <Picker
      accessibilityLabel={accessibilityLabel}
      selectedValue={value}
      onValueChange={(next) => {
        if (next !== value) onChange(Number(next));
      }}
    >
      {options.map((option) => (
        <Picker.Item
          key={option.value}
          label={option.label}
          value={option.value}
        />
      ))}
    </Picker>
  );
}
