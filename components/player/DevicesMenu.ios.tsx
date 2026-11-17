import { Host } from "@expo/ui";
import { Button, Image, Menu, Section, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  contentShape,
  disabled,
  frame,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import {
  NO_OTHER_DEVICES,
  type DevicesMenuProps,
} from "@/components/player/devices-menu-types";

export function DevicesMenu({
  device,
  onPickUp,
  triggerColor,
  accessibilityLabel,
}: DevicesMenuProps) {
  return (
    <Host matchContents ignoreSafeArea="all">
      <Menu
        label={
          <Image
            systemName="laptopcomputer.and.iphone"
            size={20}
            color={triggerColor}
            modifiers={[
              frame({ width: 44, height: 44 }),
              contentShape(shapes.rectangle()),
              accessibilityLabelModifier(accessibilityLabel),
            ]}
          />
        }
      >
        {device ? (
          <Section title="Pick up from">
            {/* A menu shows a button's second text as its subtitle. */}
            <Button onPress={onPickUp}>
              <Text>{device.name}</Text>
              <Text>{device.detail}</Text>
            </Button>
          </Section>
        ) : (
          <Button
            label={NO_OTHER_DEVICES}
            modifiers={[disabled(true)]}
            onPress={() => {}}
          />
        )}
      </Menu>
    </Host>
  );
}
