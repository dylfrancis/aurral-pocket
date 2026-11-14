import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/** The palette for the current color scheme. */
export function useColors() {
  return Colors[useColorScheme()];
}
