export type MenuPickerOption<Value extends string> = {
  value: Value;
  label: string;
};

export type MenuPickerProps<Value extends string> = {
  /** VoiceOver and TalkBack read it with the value. */
  accessibilityLabel: string;
  value: Value;
  options: readonly MenuPickerOption<Value>[];
  onChange: (value: Value) => void;
};
