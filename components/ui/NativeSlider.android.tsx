import { useRef } from "react";
import { Host } from "@expo/ui";
import { Slider } from "@expo/ui/jetpack-compose";
import {
  semantics,
  testID as testIDModifier,
} from "@expo/ui/jetpack-compose/modifiers";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { NativeSliderProps } from "./native-slider";

// A tick at every stop dots the track when steps are fine.
const NO_TICKS = "#00000000";

/** Material 3's slider. */
export function NativeSlider({
  value,
  min,
  max,
  step,
  disabled = false,
  filledTrackColor,
  unfilledTrackColor,
  thumbColor,
  accessibilityLabel,
  testID,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
}: NativeSliderProps) {
  const scheme = useColorScheme();
  const sliding = useRef(false);
  const latestValue = useRef(value);
  const modifiers = [semantics({ contentDescription: accessibilityLabel })];
  if (testID) modifiers.push(testIDModifier(testID));
  // Compose counts the stops between the ends, not the size of a step.
  const stopCount = step ? Math.max(0, Math.round((max - min) / step) - 1) : 0;

  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme}>
      <Slider
        value={value}
        min={min}
        max={max}
        steps={stopCount}
        enabled={!disabled}
        colors={{
          thumbColor,
          activeTrackColor: filledTrackColor,
          inactiveTrackColor: unfilledTrackColor,
          activeTickColor: NO_TICKS,
          inactiveTickColor: NO_TICKS,
        }}
        onValueChange={(next) => {
          // Compose has no start callback, so the first change of a drag or
          // tap starts it.
          if (!sliding.current) {
            sliding.current = true;
            onSlidingStart?.();
          }
          latestValue.current = next;
          if (next !== value) onValueChange?.(next);
        }}
        onValueChangeFinished={() => {
          // A finish with no change before it has nothing to report.
          if (!sliding.current) return;
          sliding.current = false;
          onSlidingComplete?.(latestValue.current);
        }}
        modifiers={modifiers}
      />
    </Host>
  );
}
