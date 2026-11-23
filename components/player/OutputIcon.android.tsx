import MediaOutputIcon from "@expo/material-symbols/media_output.xml";
import { Host } from "@expo/ui";
import { Icon } from "@expo/ui/jetpack-compose";
import type { OutputIconProps } from "@/components/player/OutputIcon";

/** The system output switcher's glyph. */
export function OutputIcon({ color }: OutputIconProps) {
  return (
    <Host matchContents>
      <Icon source={MediaOutputIcon} tint={color} size={28} />
    </Host>
  );
}
