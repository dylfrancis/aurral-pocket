import { Switch } from "@expo/ui";
import { labelsHidden } from "@expo/ui/swift-ui/modifiers";
import type { SettingsSwitchProps } from "@/components/settings/settings-controls";

// The row draws the label. A SwiftUI toggle with an empty one still stretches.
const MODIFIERS = [labelsHidden()];

export function SettingsSwitch({ value, onChange }: SettingsSwitchProps) {
  return (
    <Switch value={value} onValueChange={onChange} modifiers={MODIFIERS} />
  );
}
