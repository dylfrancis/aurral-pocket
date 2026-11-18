import { Host } from "@expo/ui";
import { Picker, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  pickerStyle,
  tag,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { MenuPickerProps } from "./menu-picker";

/** SwiftUI's menu picker, for a choice at the end of a row outside a form. */
export function MenuPicker<Value extends string>({
  accessibilityLabel,
  value,
  options,
  onChange,
}: MenuPickerProps<Value>) {
  const scheme = useColorScheme();
  const colors = useColors();
  return (
    <Host matchContents ignoreSafeArea="all" colorScheme={scheme}>
      <Picker<string>
        selection={value}
        onSelectionChange={(next) => {
          if (next !== value) onChange(next as Value);
        }}
        modifiers={[
          pickerStyle("menu"),
          // Outside a form the label takes the tint, which is system blue.
          tint(colors.brand),
          accessibilityLabelModifier(accessibilityLabel),
        ]}
      >
        {options.map((option) => (
          <Text key={option.value} modifiers={[tag(option.value)]}>
            {option.label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
