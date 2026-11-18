export type NumberStepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** VoiceOver and TalkBack read it with the value. */
  accessibilityLabel: string;
};
