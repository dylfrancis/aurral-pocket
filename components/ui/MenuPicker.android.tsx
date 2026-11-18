import ArrowDropDown from "@expo/material-symbols/arrow_drop_down.xml";
import Check from "@expo/material-symbols/check.xml";
import { Host } from "@expo/ui";
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
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { MenuPickerProps } from "./menu-picker";

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its anchor.
const POPUP_PROPERTIES = { clippingEnabled: false };

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
          {options.map((option) => (
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
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
