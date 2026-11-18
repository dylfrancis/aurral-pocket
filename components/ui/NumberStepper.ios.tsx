import { Host } from "@expo/ui";
import { Button, HStack, Image } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  frame,
} from "@expo/ui/swift-ui/modifiers";
import { HAS_LIQUID_GLASS } from "@/constants/navigation";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { NumberStepperProps } from "./number-stepper";

/**
 * Round − and + buttons. SwiftUI's Stepper drew about 15pt above its frame
 * in a sheet row on iOS 27, at any scroll offset, so it isn't used here.
 */
export function NumberStepper({
  value,
  min,
  max,
  onChange,
  accessibilityLabel,
}: NumberStepperProps) {
  const scheme = useColorScheme();
  const colors = useColors();

  const step = (
    icon: "minus" | "plus",
    name: "fewer" | "more",
    next: number,
    enabled: boolean,
  ) => (
    <Button
      onPress={() => onChange(next)}
      modifiers={[
        buttonStyle(HAS_LIQUID_GLASS ? "glass" : "bordered"),
        buttonBorderShape("circle"),
        controlSize("regular"),
        disabled(!enabled),
        accessibilityLabelModifier(`${accessibilityLabel}, ${name}`),
      ]}
    >
      {/* A circle fits its label, and "minus" is a flatter symbol than
          "plus", so both get the same square to keep the buttons one size. */}
      <Image
        systemName={icon}
        size={16}
        color={enabled ? colors.text : colors.tertiary}
        modifiers={[frame({ width: 20, height: 20 })]}
      />
    </Button>
  );

  return (
    <Host matchContents ignoreSafeArea="all" colorScheme={scheme}>
      <HStack spacing={8}>
        {step("minus", "fewer", Math.max(min, value - 1), value > min)}
        {step("plus", "more", Math.min(max, value + 1), value < max)}
      </HStack>
    </Host>
  );
}
