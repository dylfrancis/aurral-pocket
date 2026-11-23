import { Button, HStack, Image, Menu, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  disabled as disabledModifier,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import type { SettingsActionMenuProps } from "@/components/settings/settings-controls";
import { useColors } from "@/hooks/use-colors";

/** A SwiftUI menu off the text at the row's end, as iOS Settings draws one. */
export function SettingsActionMenu({
  triggerLabel,
  accessibilityLabel,
  actions,
  disabled,
}: SettingsActionMenuProps) {
  const colors = useColors();
  const tint = disabled ? colors.tertiary : colors.brand;

  return (
    <Menu
      label={
        <HStack spacing={4}>
          <Text>{triggerLabel}</Text>
          <Image systemName="chevron.up.chevron.down" size={11} color={tint} />
        </HStack>
      }
      modifiers={[
        foregroundStyle(tint),
        disabledModifier(!!disabled),
        accessibilityLabelModifier(accessibilityLabel),
      ]}
    >
      {actions.map((action) => (
        <Button
          key={action.key}
          label={action.label}
          onPress={action.onPress}
        />
      ))}
    </Menu>
  );
}
