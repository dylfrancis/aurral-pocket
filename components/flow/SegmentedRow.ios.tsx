import { Host } from "@expo/ui";
import { Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag, tint } from "@expo/ui/swift-ui/modifiers";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { shownSegment, type SegmentedRowProps } from "./segmented-row";

/** SwiftUI's segmented picker. */
export function SegmentedRow<T extends string | number>({
  value,
  options,
  onChange,
}: SegmentedRowProps<T>) {
  const scheme = useColorScheme();
  const colors = useColors();
  const shown = shownSegment(options, value);

  return (
    // Inside a scroll view the row passes under the header, and a host that
    // kept the bars' safe area would hold the control below them instead.
    <Host
      matchContents={{ vertical: true }}
      ignoreSafeArea="all"
      colorScheme={scheme}
    >
      <Picker<T>
        selection={shown}
        onSelectionChange={(next) => {
          if (next !== shown) onChange(next);
        }}
        modifiers={[pickerStyle("segmented"), tint(colors.brand)]}
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
