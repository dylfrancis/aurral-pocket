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
import { MONITORING_CHOICE_LABELS } from "@/lib/monitoring-rules";
import {
  NO_CUSTOM_RULES_SUBTITLE,
  NOT_MONITORED_SUBTITLE,
  type MonitoringCapsuleProps,
} from "./monitoring-capsule-types";

/** A capsule that opens the artist's monitoring in a SwiftUI menu. */
export function MonitoringCapsule({
  choice,
  defaultSummary,
  customSummary,
  onSelect,
  triggerColor,
}: MonitoringCapsuleProps) {
  const scheme = useColorScheme();
  const label = MONITORING_CHOICE_LABELS[choice];

  return (
    <Host matchContents ignoreSafeArea="all" colorScheme={scheme}>
      <Menu
        label={
          <HStack spacing={4}>
            <Image
              systemName={choice === "off" ? "eye.slash" : "eye"}
              size={12}
              color={triggerColor}
            />
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
          accessibilityLabel(`Monitoring, ${label}`),
        ]}
      >
        {/* Toggles give the menu its checkmarks. JS holds `isOn`, so picking
            the checked item again leaves it checked. */}
        <Toggle
          isOn={choice === "default"}
          onIsOnChange={(isOn) => {
            if (isOn) onSelect("default");
          }}
        >
          {/* A menu shows the second text as the item's subtitle. */}
          <Text>Default Rules</Text>
          <Text>{defaultSummary}</Text>
        </Toggle>
        <Toggle
          isOn={choice === "custom"}
          onIsOnChange={() => onSelect("custom")}
        >
          <Text>Custom Rules…</Text>
          <Text>{customSummary ?? NO_CUSTOM_RULES_SUBTITLE}</Text>
        </Toggle>
        <Toggle
          isOn={choice === "off"}
          onIsOnChange={(isOn) => {
            if (isOn) onSelect("off");
          }}
        >
          <Text>Not Monitored</Text>
          <Text>{NOT_MONITORED_SUBTITLE}</Text>
        </Toggle>
      </Menu>
    </Host>
  );
}
