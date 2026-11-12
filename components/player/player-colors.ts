import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/** The full player fades into the scheme's own background, so its foreground follows the scheme. */
export const PlayerColors = {
  dark: {
    background: Colors.dark.background,
    text: Colors.dark.text,
    // Brighter than the theme's gray, which drops below 4.5:1 on the tint.
    subtle: "rgba(255, 255, 255, 0.7)",
    faint: "rgba(255, 255, 255, 0.35)",
    separator: "rgba(255, 255, 255, 0.15)",
    pressedFill: "rgba(255, 255, 255, 0.15)",
    selectedFill: "rgba(255, 255, 255, 0.9)",
    brand: Colors.dark.brand,
  },
  light: {
    background: Colors.light.background,
    text: Colors.light.text,
    subtle: Colors.light.subtle,
    faint: "rgba(0, 0, 0, 0.25)",
    separator: "rgba(0, 0, 0, 0.1)",
    pressedFill: "rgba(0, 0, 0, 0.08)",
    selectedFill: "rgba(0, 0, 0, 0.85)",
    brand: Colors.light.brand,
  },
};

/**
 * Lifts artwork off the tint behind it. A box shadow isn't cut by the view's
 * own clip, so one view can both round the art and shade it.
 */
export const ARTWORK_SHADOW = "0px 10px 18px rgba(0, 0, 0, 0.3)";

export function usePlayerColors() {
  return PlayerColors[useColorScheme()];
}
