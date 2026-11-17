import { Switch } from "@expo/ui";
import { labelsHidden } from "@expo/ui/swift-ui/modifiers";
import type { SettingsSwitchProps } from "@/components/settings/settings-controls";

// The row draws the label. A SwiftUI toggle with an empty one still stretches.
const MODIFIERS = [labelsHidden()];

/** A hidden label still names the toggle to VoiceOver. */
export function SettingsSwitch({
  value,
  onChange,
  accessibilityLabel,
}: SettingsSwitchProps) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      label={accessibilityLabel}
      modifiers={MODIFIERS}
    />
  );
}
