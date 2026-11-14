export type SettingsPickerOption = { value: number; label: string };

export type SettingsPickerProps = {
  value: number;
  options: readonly SettingsPickerOption[];
  onChange: (value: number) => void;
};

export type SettingsSwitchProps = {
  value: boolean;
  onChange: (value: boolean) => void;
};
