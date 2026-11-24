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
  onValueChange?: (value: number) => void;
  onSlidingStart?: () => void;
  /**
   * When a change finishes, with its value: as the finger lifts, or at once
   * for a change outside a drag.
   */
  onSlidingComplete?: (value: number) => void;
};
