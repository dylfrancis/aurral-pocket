import { Switch as RNSwitch, type SwitchProps } from "react-native";
import { useColors } from "@/hooks/use-colors";

/** React Native's switch in the app's track and thumb colors. */
export function Switch(
  props: Omit<SwitchProps, "trackColor" | "thumbColor" | "ios_backgroundColor">,
) {
  const colors = useColors();
  return (
    <RNSwitch
      trackColor={{ false: colors.separator, true: colors.brand }}
      thumbColor={colors.switchThumb}
      ios_backgroundColor={colors.separator}
      {...props}
    />
  );
}
