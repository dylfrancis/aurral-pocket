import ArrowDropDown from "@expo/material-symbols/arrow_drop_down.xml";
import Check from "@expo/material-symbols/check.xml";
import { Host } from "@expo/ui";
import {
  AssistChip,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  Text,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { editionSubtitle, editionLabel } from "@/lib/editions";
import type { EditionPickerProps } from "./edition-picker-types";

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its chip.
const POPUP_PROPERTIES = { clippingEnabled: false };

/** A chip that opens the album's editions in a Compose dropdown. */
export function EditionPicker({
  editions,
  selectedId,
  libraryId,
  onSelect,
  triggerColor,
}: EditionPickerProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const [expanded, setExpanded] = useState(false);
  const selected = editions.find((edition) => edition.id === selectedId);
  if (!selected) return null;

  return (
    <Host matchContents colorScheme={scheme}>
      <DropdownMenu
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
        properties={POPUP_PROPERTIES}
      >
        <DropdownMenu.Trigger>
          <AssistChip
            onClick={() => setExpanded(true)}
            colors={{
              labelColor: triggerColor,
              trailingIconContentColor: triggerColor,
            }}
            border={{ color: colors.separator }}
          >
            <AssistChip.Label>
              <Text color={triggerColor}>{editionLabel(selected.name)}</Text>
            </AssistChip.Label>
            <AssistChip.TrailingIcon>
              <Icon source={ArrowDropDown} size={18} tint={triggerColor} />
            </AssistChip.TrailingIcon>
          </AssistChip>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {editions.map((edition) => (
            <DropdownMenuItem
              key={edition.id}
              onClick={() => {
                setExpanded(false);
                if (edition.id !== selectedId) onSelect(edition.id);
              }}
            >
              <DropdownMenuItem.Text>
                <Column>
                  <Text color={colors.text}>{edition.name}</Text>
                  <Text
                    color={colors.subtle}
                    style={{ typography: "bodySmall" }}
                  >
                    {editionSubtitle(edition, libraryId)}
                  </Text>
                </Column>
              </DropdownMenuItem.Text>
              {edition.id === selectedId ? (
                <DropdownMenuItem.TrailingIcon>
                  <Icon source={Check} size={24} tint={colors.brand} />
                </DropdownMenuItem.TrailingIcon>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
