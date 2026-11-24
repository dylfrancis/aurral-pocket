import { Host } from "@expo/ui";
import { Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { shownSegment, type SegmentedRowProps } from "./segmented-row";

/**
 * SwiftUI's segmented picker. It ignores `tint`, so the selected segment takes
 * the system's color.
 */
export function SegmentedRow<T extends string | number>({
  value,
  options,
  onChange,
}: SegmentedRowProps<T>) {
  const scheme = useColorScheme();
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
        modifiers={[pickerStyle("segmented")]}
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
