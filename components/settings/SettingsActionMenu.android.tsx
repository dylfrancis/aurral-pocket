import ArrowDropDown from "@expo/material-symbols/arrow_drop_down.xml";
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
import type { SettingsActionMenuProps } from "@/components/settings/settings-controls";
import { useColors } from "@/hooks/use-colors";

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its anchor.
const POPUP_PROPERTIES = { clippingEnabled: false };

/** A Compose menu off the text at the row's end, like SettingsPicker's. */
export function SettingsActionMenu({
  triggerLabel,
  accessibilityLabel,
  actions,
  disabled,
}: SettingsActionMenuProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const tint = disabled ? colors.tertiary : colors.brand;

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
            clickable(() => {
              if (!disabled) setExpanded(true);
            }),
            semantics({ contentDescription: accessibilityLabel }),
          ]}
        >
          <Text color={tint}>{triggerLabel}</Text>
          <Icon source={ArrowDropDown} size={24} tint={tint} />
        </Row>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            onClick={() => {
              setExpanded(false);
              action.onPress();
            }}
          >
            <DropdownMenuItem.Text>
              <Text>{action.label}</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
