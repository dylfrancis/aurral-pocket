import { Host } from "@expo/ui";
import {
  Button,
  Divider,
  HStack,
  Image,
  Menu,
  Text,
  Toggle,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { HAS_LIQUID_GLASS } from "@/constants/navigation";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  NO_CUSTOM_RULES_SUBTITLE,
  NOT_MONITORED_SUBTITLE,
  REMOVE_FROM_LIBRARY,
  libraryCapsuleAccessibilityLabel,
  libraryCapsuleLabel,
  type ArtistLibraryCapsuleProps,
} from "./artist-library-capsule-types";

/**
 * "In Library · Monitored": a capsule that opens a SwiftUI menu with the
 * artist's monitoring and Remove from Library.
 */
export function ArtistLibraryCapsule({
  choice,
  defaultSummary,
  customSummary,
  onSelect,
  onRemove,
  triggerColor,
}: ArtistLibraryCapsuleProps) {
  const scheme = useColorScheme();
  const canSelect = !!onSelect && choice !== null;

  return (
    <Host matchContents ignoreSafeArea="all" colorScheme={scheme}>
      <Menu
        label={
          <HStack spacing={4}>
            <Image
              systemName="checkmark.circle.fill"
              size={12}
              color={triggerColor}
            />
            <Text>{libraryCapsuleLabel(choice)}</Text>
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
          accessibilityLabel(libraryCapsuleAccessibilityLabel(choice)),
        ]}
      >
        {/* Toggles give the menu its checkmarks. JS holds `isOn`, so picking
            the checked item again leaves it checked. */}
        {canSelect ? (
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
        ) : null}
        {canSelect ? (
          <Toggle
            isOn={choice === "custom"}
            onIsOnChange={() => onSelect("custom")}
          >
            <Text>Custom Rules…</Text>
            <Text>{customSummary ?? NO_CUSTOM_RULES_SUBTITLE}</Text>
          </Toggle>
        ) : null}
        {canSelect ? (
          <Toggle
            isOn={choice === "off"}
            onIsOnChange={(isOn) => {
              if (isOn) onSelect("off");
            }}
          >
            <Text>Not Monitored</Text>
            <Text>{NOT_MONITORED_SUBTITLE}</Text>
          </Toggle>
        ) : null}
        {canSelect && onRemove ? <Divider /> : null}
        {onRemove ? (
          <Button
            role="destructive"
            systemImage="trash"
            label={REMOVE_FROM_LIBRARY}
            onPress={onRemove}
          />
        ) : null}
      </Menu>
    </Host>
  );
}
