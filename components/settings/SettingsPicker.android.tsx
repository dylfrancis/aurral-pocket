import ArrowDropDown from "@expo/material-symbols/arrow_drop_down.xml";
import Check from "@expo/material-symbols/check.xml";
import {
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  defaultMinSize,
  semantics,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import type { SettingsPickerProps } from "@/components/settings/settings-controls";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its anchor.
const POPUP_PROPERTIES = { clippingEnabled: false };

/**
 * A Compose menu off the value at the row's end. The universal Picker draws a
 * full-width form field, which doesn't fit a row.
 */
export function SettingsPicker({
  accessibilityLabel,
  value,
  options,
  onChange,
}: SettingsPickerProps) {
  const colors = Colors[useColorScheme()];
  const [expanded, setExpanded] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu
      expanded={expanded}
      onDismissRequest={() => setExpanded(false)}
      properties={POPUP_PROPERTIES}
    >
      <DropdownMenu.Trigger>
        <Row
          verticalAlignment="center"
          modifiers={[
            defaultMinSize({ minWidth: 48, minHeight: 48 }),
            clickable(() => setExpanded(true)),
            semantics({ contentDescription: accessibilityLabel }),
          ]}
        >
          {/* Android's text doesn't follow the app's light or dark choice. */}
          <Text color={colors.subtle}>{selected?.label ?? ""}</Text>
          <Icon source={ArrowDropDown} size={24} tint={colors.subtle} />
        </Row>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => {
              setExpanded(false);
              if (option.value !== value) onChange(option.value);
            }}
          >
            <DropdownMenuItem.Text>
              <Text>{option.label}</Text>
            </DropdownMenuItem.Text>
            {option.value === value ? (
              <DropdownMenuItem.TrailingIcon>
                <Icon source={Check} size={24} tint={colors.brand} />
              </DropdownMenuItem.TrailingIcon>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
