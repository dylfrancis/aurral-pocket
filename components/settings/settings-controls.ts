export type SettingsPickerOption = { value: number; label: string };

export type SettingsPickerProps = {
  /** VoiceOver and TalkBack read it with the value. */
  accessibilityLabel: string;
  value: number;
  options: readonly SettingsPickerOption[];
  onChange: (value: number) => void;
};

export type SettingsSwitchProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  /** For a switch outside a settings row, which names it there. */
  accessibilityLabel?: string;
};
