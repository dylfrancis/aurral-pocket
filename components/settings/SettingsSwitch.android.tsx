import { Switch } from "@expo/ui";
import type { SettingsSwitchProps } from "@/components/settings/settings-controls";

export function SettingsSwitch({ value, onChange }: SettingsSwitchProps) {
  return <Switch value={value} onValueChange={onChange} />;
}
