import { useRef } from "react";
import { Host } from "@expo/ui";
import { Slider } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  disabled as disabledModifier,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { NativeSliderProps } from "./native-slider";

/**
 * SwiftUI's slider. It has no colors for the thumb or the track right of it,
 * so only `color` applies.
 */
export function NativeSlider({
  value,
  min,
  max,
  step,
  disabled = false,
  color,
  accessibilityLabel,
  testID,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
}: NativeSliderProps) {
  const scheme = useColorScheme();
  const editing = useRef(false);
  const last = useRef(value);

  return (
    // Inside a scroll view the slider passes under the header, and a host
    // that kept the bars' safe area would hold it below them instead.
    <Host
      matchContents={{ vertical: true }}
      ignoreSafeArea="all"
      colorScheme={scheme}
    >
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        testID={testID}
        onValueChange={(next) => {
          last.current = next;
          onValueChange?.(next);
          // A VoiceOver adjustment may arrive with no editing events around
          // it, so a change outside a drag counts as finished at once.
          if (!editing.current) onSlidingComplete?.(next);
        }}
        onEditingChanged={(isEditing) => {
          editing.current = isEditing;
          if (isEditing) {
            // A press that moves nothing ends where the thumb rests.
            last.current = value;
            onSlidingStart?.();
          } else {
            onSlidingComplete?.(last.current);
          }
        }}
        modifiers={[
          tint(color),
          disabledModifier(disabled),
          accessibilityLabelModifier(accessibilityLabel),
        ]}
      />
    </Host>
  );
}
