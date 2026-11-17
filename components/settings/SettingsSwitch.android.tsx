import { Switch } from "@expo/ui/jetpack-compose";
import { semantics } from "@expo/ui/jetpack-compose/modifiers";
import type { SettingsSwitchProps } from "@/components/settings/settings-controls";
import { useColors } from "@/hooks/use-colors";

/**
 * Compose's switch, since the universal one draws a label it's given; TalkBack
 * gets the label alone. Compose's default colors ignore the app's theme.
 */
export function SettingsSwitch({
  value,
  onChange,
  accessibilityLabel,
}: SettingsSwitchProps) {
  const colors = useColors();
  return (
    <Switch
      value={value}
      onCheckedChange={onChange}
      colors={{
        checkedTrackColor: colors.brand,
        checkedBorderColor: colors.brand,
        checkedThumbColor: colors.switchThumb,
      }}
      modifiers={
        accessibilityLabel
          ? [semantics({ contentDescription: accessibilityLabel })]
          : undefined
      }
    />
  );
}
