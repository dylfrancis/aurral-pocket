import ArrowDropDown from "@expo/material-symbols/arrow_drop_down.xml";
import Check from "@expo/material-symbols/check.xml";
import Visibility from "@expo/material-symbols/visibility.xml";
import VisibilityOff from "@expo/material-symbols/visibility_off.xml";
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
  MONITORING_CHOICE_LABELS,
  type MonitoringChoice,
} from "@/lib/monitoring-rules";
import {
  NO_CUSTOM_RULES_SUBTITLE,
  NOT_MONITORED_SUBTITLE,
  type MonitoringCapsuleProps,
} from "./monitoring-capsule-types";

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its chip.
const POPUP_PROPERTIES = { clippingEnabled: false };

/** A chip that opens the artist's monitoring in a Compose dropdown. */
export function MonitoringCapsule({
  choice,
  defaultSummary,
  customSummary,
  onSelect,
  triggerColor,
}: MonitoringCapsuleProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const [expanded, setExpanded] = useState(false);

  const items: { value: MonitoringChoice; title: string; subtitle: string }[] =
    [
      { value: "default", title: "Default Rules", subtitle: defaultSummary },
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
    ];

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
              leadingIconContentColor: triggerColor,
              trailingIconContentColor: triggerColor,
            }}
            border={{ color: colors.separator }}
          >
            <AssistChip.LeadingIcon>
              <Icon
                source={choice === "off" ? VisibilityOff : Visibility}
                size={18}
                tint={triggerColor}
              />
            </AssistChip.LeadingIcon>
            <AssistChip.Label>
              <Text color={triggerColor}>
                {MONITORING_CHOICE_LABELS[choice]}
              </Text>
            </AssistChip.Label>
            <AssistChip.TrailingIcon>
              <Icon source={ArrowDropDown} size={18} tint={triggerColor} />
            </AssistChip.TrailingIcon>
          </AssistChip>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {items.map((item) => (
            <DropdownMenuItem
              key={item.value}
              onClick={() => {
                setExpanded(false);
                onSelect(item.value);
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
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
