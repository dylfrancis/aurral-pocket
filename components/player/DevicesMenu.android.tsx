import DevicesIcon from "@expo/material-symbols/devices.xml";
import PlayCircleIcon from "@expo/material-symbols/play_circle.xml";
import { Host } from "@expo/ui";
import {
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  IconButton,
  Text,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";
import {
  NO_OTHER_DEVICES,
  type DevicesMenuProps,
} from "@/components/player/devices-menu-types";

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its button.
const POPUP_PROPERTIES = { clippingEnabled: false };

export function DevicesMenu({
  device,
  onPickUp,
  triggerColor,
  accessibilityLabel,
}: DevicesMenuProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Host matchContents>
      <DropdownMenu
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
        properties={POPUP_PROPERTIES}
      >
        <DropdownMenu.Trigger>
          <IconButton onClick={() => setExpanded(true)}>
            <Icon
              source={DevicesIcon}
              tint={triggerColor}
              size={24}
              contentDescription={accessibilityLabel}
            />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {device ? (
            <DropdownMenuItem
              onClick={() => {
                setExpanded(false);
                onPickUp();
              }}
            >
              <DropdownMenuItem.Text>
                {/* A Compose menu has no section title, so the item says it. */}
                <Column>
                  <Text>{`Pick up from ${device.name}`}</Text>
                  <Text style={{ typography: "bodySmall" }}>
                    {device.detail}
                  </Text>
                </Column>
              </DropdownMenuItem.Text>
              <DropdownMenuItem.LeadingIcon>
                <Icon source={PlayCircleIcon} size={24} />
              </DropdownMenuItem.LeadingIcon>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem enabled={false} onClick={() => {}}>
              <DropdownMenuItem.Text>
                <Text>{NO_OTHER_DEVICES}</Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          )}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
