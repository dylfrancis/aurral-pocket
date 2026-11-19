import ArrowDropDown from "@expo/material-symbols/arrow_drop_down.xml";
import Check from "@expo/material-symbols/check.xml";
import CheckCircle from "@expo/material-symbols/check_circle.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import { Host } from "@expo/ui";
import {
  AssistChip,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Icon,
  Text,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { MonitoringChoice } from "@/lib/monitoring-rules";
import {
  NO_CUSTOM_RULES_SUBTITLE,
  NOT_MONITORED_SUBTITLE,
  REMOVE_FROM_LIBRARY,
  libraryCapsuleAccessibilityLabel,
  libraryCapsuleLabel,
  type ArtistLibraryCapsuleProps,
} from "./artist-library-capsule-types";

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its chip.
const POPUP_PROPERTIES = { clippingEnabled: false };

export function ArtistLibraryCapsule({
  choice,
  defaultSummary,
  customSummary,
  onSelect,
  onRemove,
  triggerColor,
}: ArtistLibraryCapsuleProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const [expanded, setExpanded] = useState(false);
  const canSelect = !!onSelect && choice !== null;

  const items: { value: MonitoringChoice; title: string; subtitle: string }[] =
    canSelect
      ? [
          {
            value: "default",
            title: "Default Rules",
            subtitle: defaultSummary,
          },
          {
            value: "custom",
            title: "Custom Rules…",
            subtitle: customSummary ?? NO_CUSTOM_RULES_SUBTITLE,
          },
          {
            value: "off",
            title: "Not Monitored",
            subtitle: NOT_MONITORED_SUBTITLE,
          },
        ]
      : [];
  const hasMenu = items.length > 0 || !!onRemove;

  return (
    <Host matchContents colorScheme={scheme}>
      <DropdownMenu
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
        properties={POPUP_PROPERTIES}
      >
        <DropdownMenu.Trigger>
          <AssistChip
            onClick={() => {
              if (hasMenu) setExpanded(true);
            }}
            colors={{
              labelColor: triggerColor,
              leadingIconContentColor: triggerColor,
              trailingIconContentColor: triggerColor,
            }}
            border={{ color: colors.separator }}
          >
            <AssistChip.LeadingIcon>
              <Icon
                source={CheckCircle}
                size={18}
                tint={triggerColor}
                contentDescription={libraryCapsuleAccessibilityLabel(choice)}
              />
            </AssistChip.LeadingIcon>
            <AssistChip.Label>
              <Text color={triggerColor}>{libraryCapsuleLabel(choice)}</Text>
            </AssistChip.Label>
            {hasMenu ? (
              <AssistChip.TrailingIcon>
                <Icon source={ArrowDropDown} size={18} tint={triggerColor} />
              </AssistChip.TrailingIcon>
            ) : null}
          </AssistChip>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {items.map((item) => (
            <DropdownMenuItem
              key={item.value}
              onClick={() => {
                setExpanded(false);
                onSelect?.(item.value);
              }}
            >
              <DropdownMenuItem.Text>
                <Column>
                  <Text color={colors.text}>{item.title}</Text>
                  <Text
                    color={colors.subtle}
                    style={{ typography: "bodySmall" }}
                  >
                    {item.subtitle}
                  </Text>
                </Column>
              </DropdownMenuItem.Text>
              {item.value === choice ? (
                <DropdownMenuItem.TrailingIcon>
                  <Icon source={Check} size={24} tint={colors.brand} />
                </DropdownMenuItem.TrailingIcon>
              ) : null}
            </DropdownMenuItem>
          ))}
          {items.length > 0 && onRemove ? <HorizontalDivider /> : null}
          {onRemove ? (
            <DropdownMenuItem
              elementColors={{
                textColor: colors.error,
                leadingIconColor: colors.error,
              }}
              onClick={() => {
                setExpanded(false);
                onRemove();
              }}
            >
              <DropdownMenuItem.Text>
                <Text>{REMOVE_FROM_LIBRARY}</Text>
              </DropdownMenuItem.Text>
              <DropdownMenuItem.LeadingIcon>
                <Icon source={DeleteIcon} size={24} />
              </DropdownMenuItem.LeadingIcon>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
