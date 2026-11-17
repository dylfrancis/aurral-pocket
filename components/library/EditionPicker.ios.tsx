import { Host } from "@expo/ui";
import { HStack, Image, Menu, Text, Toggle } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { HAS_LIQUID_GLASS } from "@/constants/navigation";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { editionSubtitle, editionLabel } from "@/lib/editions";
import type { EditionPickerProps } from "./edition-picker-types";

/** A capsule that opens the album's editions in a SwiftUI menu. */
export function EditionPicker({
  editions,
  selectedId,
  libraryId,
  onSelect,
  triggerColor,
}: EditionPickerProps) {
  const scheme = useColorScheme();
  const selected = editions.find((edition) => edition.id === selectedId);
  if (!selected) return null;
  const label = editionLabel(selected.name);

  return (
    <Host matchContents ignoreSafeArea="all" colorScheme={scheme}>
      <Menu
        label={
          <HStack spacing={4}>
            <Text>{label}</Text>
            <Image
              systemName="chevron.up.chevron.down"
              size={11}
              color={triggerColor}
            />
          </HStack>
        }
        modifiers={[
          buttonStyle(HAS_LIQUID_GLASS ? "glass" : "bordered"),
          buttonBorderShape("capsule"),
          controlSize("small"),
          foregroundStyle(triggerColor),
          // On the menu: on its label, VoiceOver read the name twice.
          accessibilityLabel(`Edition, ${label}`),
        ]}
      >
        {editions.map((edition) => (
          // A toggle gives the menu its checkmark. JS holds `isOn`, so
          // picking the checked edition again leaves it checked.
          <Toggle
            key={edition.id}
            isOn={edition.id === selectedId}
            onIsOnChange={(isOn) => {
              if (isOn) onSelect(edition.id);
            }}
          >
            {/* A menu shows the second text as the item's subtitle. */}
            <Text>{edition.name}</Text>
            <Text>{editionSubtitle(edition, libraryId)}</Text>
          </Toggle>
        ))}
      </Menu>
    </Host>
  );
}
