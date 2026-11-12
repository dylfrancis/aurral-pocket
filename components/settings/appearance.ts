import type { ThemePreference } from "@/lib/types/theme";

export const APPEARANCE_OPTIONS: ThemePreference[] = [
  "system",
  "light",
  "dark",
];

export const APPEARANCE_LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};
