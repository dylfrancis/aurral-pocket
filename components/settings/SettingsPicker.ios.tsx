import { Picker, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  pickerStyle,
  tag,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import type { SettingsPickerProps } from "@/components/settings/settings-controls";
import { useColors } from "@/hooks/use-colors";

/**
 * SwiftUI's menu picker, as iOS Settings draws a choice in a row. Built from
 * SwiftUI's own, since the universal `Picker` takes no modifiers to tint it.
 */
export function SettingsPicker({
  accessibilityLabel,
  value,
  options,
  onChange,
}: SettingsPickerProps) {
  const colors = useColors();
  return (
    <Picker<number>
      selection={value}
      onSelectionChange={(next) => {
        if (next !== value) onChange(Number(next));
      }}
      modifiers={[
        pickerStyle("menu"),
        // Without it, the value is system blue rather than the brand's.
        tint(colors.brand),
        accessibilityLabelModifier(accessibilityLabel),
      ]}
    >
      {options.map((option) => (
        <Text key={option.value} modifiers={[tag(option.value)]}>
          {option.label}
        </Text>
      ))}
    </Picker>
  );
}
