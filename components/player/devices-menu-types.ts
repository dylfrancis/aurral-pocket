export type DevicesMenuProps = {
  /** The device whose queue can be picked up here, or null for none. */
  device: {
    name: string;
    /** The track, where it stopped, and when, as in "Roads · 2:14 · 1 min ago". */
    detail: string;
  } | null;
  onPickUp: () => void;
  triggerColor: string;
  accessibilityLabel: string;
};

export const NO_OTHER_DEVICES = "No other devices";
