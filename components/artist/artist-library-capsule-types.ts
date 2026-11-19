import {
  MONITORING_CHOICE_LABELS,
  type MonitoringChoice,
} from "@/lib/monitoring-rules";

export type ArtistLibraryCapsuleProps = {
  /** Null when the artist has no monitoring to show. */
  choice: MonitoringChoice | null;
  defaultSummary: string;
  /** The artist's own rules in a line, when it has them. */
  customSummary: string | null;
  /**
   * Omit for someone who can't change monitoring: the capsule still names it.
   * Custom Rules always comes back, so the rules can be edited again.
   */
  onSelect?: (choice: MonitoringChoice) => void;
  /** Omit to leave Remove from Library out of the menu. */
  onRemove?: () => void;
  triggerColor: string;
};

export const NOT_MONITORED_SUBTITLE = "Nothing new downloads";
export const NO_CUSTOM_RULES_SUBTITLE = "Pick what downloads";
export const REMOVE_FROM_LIBRARY = "Remove from Library";

export function libraryCapsuleLabel(choice: MonitoringChoice | null) {
  return choice
    ? `In Library · ${MONITORING_CHOICE_LABELS[choice]}`
    : "In Library";
}

export function libraryCapsuleAccessibilityLabel(
  choice: MonitoringChoice | null,
) {
  return choice
    ? `In Library, ${MONITORING_CHOICE_LABELS[choice]}`
    : "In Library";
}
