import Add from "@expo/material-symbols/add.xml";
import Remove from "@expo/material-symbols/remove.xml";
import { Host } from "@expo/ui";
import { FilledTonalIconButton, Icon, Row } from "@expo/ui/jetpack-compose";
import { semantics } from "@expo/ui/jetpack-compose/modifiers";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { NumberStepperProps } from "./number-stepper";

/** Compose has no stepper, so two tonal icon buttons stand in for one. */
export function NumberStepper({
  value,
  min,
  max,
  onChange,
  accessibilityLabel,
}: NumberStepperProps) {
  const scheme = useColorScheme();
  const colors = useColors();
  const buttonColors = {
    // Translucent, so the buttons show on a sheet as well as on a page.
    containerColor: colors.tagFill,
    disabledContainerColor: colors.tagFill,
  };

  return (
    <Host matchContents colorScheme={scheme}>
      <Row horizontalArrangement={{ spacedBy: 8 }}>
        <FilledTonalIconButton
          enabled={value > min}
          onClick={() => onChange(Math.max(min, value - 1))}
          colors={buttonColors}
          modifiers={[
            semantics({ contentDescription: `${accessibilityLabel}, fewer` }),
          ]}
        >
          <Icon
            source={Remove}
            size={20}
            tint={value > min ? colors.text : colors.tertiary}
          />
        </FilledTonalIconButton>
        <FilledTonalIconButton
          enabled={value < max}
          onClick={() => onChange(Math.min(max, value + 1))}
          colors={buttonColors}
          modifiers={[
            semantics({ contentDescription: `${accessibilityLabel}, more` }),
          ]}
        >
          <Icon
            source={Add}
            size={20}
            tint={value < max ? colors.text : colors.tertiary}
          />
        </FilledTonalIconButton>
      </Row>
    </Host>
  );
}
