import type { MonitoringChoice } from "@/lib/monitoring-rules";

export type MonitoringCapsuleProps = {
  choice: MonitoringChoice;
  defaultSummary: string;
  /** The artist's own rules in a line, when it has them. */
  customSummary: string | null;
  /** Custom Rules always comes back, so the rules can be edited again. */
  onSelect: (choice: MonitoringChoice) => void;
  triggerColor: string;
};

export const NOT_MONITORED_SUBTITLE = "Nothing new downloads";
export const NO_CUSTOM_RULES_SUBTITLE = "Pick what downloads";
