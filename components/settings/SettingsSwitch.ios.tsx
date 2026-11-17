import { Switch } from "@expo/ui";
import { labelsHidden, tint } from "@expo/ui/swift-ui/modifiers";
import type { SettingsSwitchProps } from "@/components/settings/settings-controls";
import { useColors } from "@/hooks/use-colors";

/** A hidden label still names the toggle to VoiceOver. */
export function SettingsSwitch({
  value,
  onChange,
  accessibilityLabel,
}: SettingsSwitchProps) {
  const colors = useColors();
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      label={accessibilityLabel}
      modifiers={[
        // The row draws the label. A SwiftUI toggle with an empty one still
        // stretches.
        labelsHidden(),
        // Without it, the toggle is the system green rather than the brand's.
        tint(colors.brand),
      ]}
    />
  );
}
