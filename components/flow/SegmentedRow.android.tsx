import { Host } from "@expo/ui";
import {
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth, weight } from "@expo/ui/jetpack-compose/modifiers";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { shownSegment, type SegmentedRowProps } from "./segmented-row";

/** Material 3 segmented buttons across the full width. */
export function SegmentedRow<T extends string | number>({
  value,
  options,
  onChange,
}: SegmentedRowProps<T>) {
  const scheme = useColorScheme();
  const colors = useColors();
  const shown = shownSegment(options, value);
  const buttonColors = {
    activeContainerColor: colors.brand,
    activeContentColor: colors.buttonPrimaryText,
    activeBorderColor: colors.brand,
    inactiveContainerColor: colors.inputBackground,
    inactiveContentColor: colors.text,
    inactiveBorderColor: colors.separator,
  };

  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme}>
      <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
        {options.map((option) => {
          const isSelected = option.value === shown;
          return (
            <SegmentedButton
              key={option.value}
              selected={isSelected}
              onClick={() => {
                if (!isSelected) onChange(option.value);
              }}
              colors={buttonColors}
              modifiers={[weight(1)]}
            >
              <SegmentedButton.Label>
                {/* Android's text doesn't follow the app's light or dark choice. */}
                <Text
                  color={isSelected ? colors.buttonPrimaryText : colors.text}
                >
                  {option.label}
                </Text>
              </SegmentedButton.Label>
            </SegmentedButton>
          );
        })}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
