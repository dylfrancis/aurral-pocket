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
import {
  ENTER_LOCATION_LABEL,
  savedLocationSubtitle,
  YOUR_LOCATION_LABEL,
  type NearbyLocationMenuProps,
} from "./nearby-location-menu-types";

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its chip.
const POPUP_PROPERTIES = { clippingEnabled: false };

/** A chip naming the city that opens the location choices in a Compose dropdown. */
export function NearbyLocationMenu({
  cityLabel,
  mode,
  appliedZip,
  appliedCountry,
  onSelectYourLocation,
  onEnterLocation,
  triggerColor,
}: NearbyLocationMenuProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const [expanded, setExpanded] = useState(false);
  const saved = savedLocationSubtitle(appliedZip, appliedCountry);

  const checkmark = (selected: boolean) =>
    selected ? (
      <DropdownMenuItem.TrailingIcon>
        <Icon source={Check} size={24} tint={colors.brand} />
      </DropdownMenuItem.TrailingIcon>
    ) : null;

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
              <Text color={triggerColor}>{cityLabel}</Text>
            </AssistChip.Label>
            <AssistChip.TrailingIcon>
              <Icon source={ArrowDropDown} size={18} tint={triggerColor} />
            </AssistChip.TrailingIcon>
          </AssistChip>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          <DropdownMenuItem
            onClick={() => {
              setExpanded(false);
              onSelectYourLocation();
            }}
          >
            <DropdownMenuItem.Text>
              <Text color={colors.text}>{YOUR_LOCATION_LABEL}</Text>
            </DropdownMenuItem.Text>
            {checkmark(mode === "ip")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setExpanded(false);
              onEnterLocation();
            }}
          >
            <DropdownMenuItem.Text>
              <Column>
                <Text color={colors.text}>{ENTER_LOCATION_LABEL}</Text>
                {saved ? (
                  <Text
                    color={colors.subtle}
                    style={{ typography: "bodySmall" }}
                  >
                    {saved}
                  </Text>
                ) : null}
              </Column>
            </DropdownMenuItem.Text>
            {checkmark(mode === "zip")}
          </DropdownMenuItem>
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
