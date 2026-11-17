import { Switch } from "@expo/ui";
import { semantics } from "@expo/ui/jetpack-compose/modifiers";
import type { SettingsSwitchProps } from "@/components/settings/settings-controls";

/** A label on the universal switch would draw it, so TalkBack gets it alone. */
export function SettingsSwitch({
  value,
  onChange,
  accessibilityLabel,
}: SettingsSwitchProps) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      modifiers={
        accessibilityLabel
          ? [semantics({ contentDescription: accessibilityLabel })]
          : undefined
      }
    />
  );
}
