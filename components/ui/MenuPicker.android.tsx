import ArrowDropDown from "@expo/material-symbols/arrow_drop_down.xml";
import Check from "@expo/material-symbols/check.xml";
import { Host } from "@expo/ui";
import {
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  defaultMinSize,
  height,
  semantics,
  verticalScroll,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { MenuPickerProps } from "./menu-picker";

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its anchor.
const POPUP_PROPERTIES = { clippingEnabled: false };

// Unclipped, the menu has no height limit and a long list runs under the
// system bars, so past this many rows it scrolls. The half row shows there's
// more. A lazy list can't go here: the menu measures its rows' widths.
const MAX_VISIBLE_ROWS = 6.5;
// Material 3's menu row height.
const ROW_HEIGHT = 48;

export function MenuPicker<Value extends string>({
  accessibilityLabel,
  value,
  options,
  onChange,
}: MenuPickerProps<Value>) {
  const scheme = useColorScheme();
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const selected = options.find((option) => option.value === value);

  const items = options.map((option) => (
    <DropdownMenuItem
      key={option.value}
      onClick={() => {
        setExpanded(false);
        if (option.value !== value) onChange(option.value);
      }}
    >
      <DropdownMenuItem.Text>
        <Text color={colors.text}>{option.label}</Text>
      </DropdownMenuItem.Text>
      {option.value === value ? (
        <DropdownMenuItem.TrailingIcon>
          <Icon source={Check} size={24} tint={colors.brand} />
        </DropdownMenuItem.TrailingIcon>
      ) : null}
    </DropdownMenuItem>
  ));

  return (
    <Host matchContents colorScheme={scheme}>
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
              semantics({
                contentDescription: `${accessibilityLabel}, ${selected?.label ?? ""}`,
              }),
            ]}
          >
            {/* Android's text doesn't follow the app's light or dark choice. */}
            <Text color={colors.brand}>{selected?.label ?? ""}</Text>
            <Icon source={ArrowDropDown} size={24} tint={colors.brand} />
          </Row>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {options.length > MAX_VISIBLE_ROWS ? (
            <Column
              modifiers={[
                height(MAX_VISIBLE_ROWS * ROW_HEIGHT),
                verticalScroll(),
              ]}
            >
              {items}
            </Column>
          ) : (
            items
          )}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
