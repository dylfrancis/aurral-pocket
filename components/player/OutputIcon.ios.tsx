import { SymbolView } from "expo-symbols";
import type { OutputIconProps } from "@/components/player/OutputIcon";

/** AirPlay's glyph. */
export function OutputIcon({ color }: OutputIconProps) {
  return <SymbolView name="airplayaudio" size={24} tintColor={color} />;
}
