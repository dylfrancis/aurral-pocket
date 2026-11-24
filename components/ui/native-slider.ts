export type NativeSliderProps = {
  value: number;
  min: number;
  max: number;
  /** Snaps the value to steps of this size from `min`, drawing no ticks. */
  step?: number;
  disabled?: boolean;
  filledTrackColor: string;
  /** Android only: iOS draws the system color. */
  unfilledTrackColor: string;
  /** Android only: iOS draws the system thumb. */
  thumbColor: string;
  /** VoiceOver and TalkBack read it before the value. */
  accessibilityLabel: string;
  testID?: string;
  /** Each change while the value moves. */
  onValueChange?: (value: number) => void;
  onSlidingStart?: () => void;
  /** Once the finger lifts, with the value it settled on. */
  onSlidingComplete?: (value: number) => void;
};
