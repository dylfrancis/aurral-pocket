import { Switch as RNSwitch, type SwitchProps } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/** React Native's switch in the app's track and thumb colors. */
export function Switch(
  props: Omit<SwitchProps, "trackColor" | "thumbColor" | "ios_backgroundColor">,
) {
  const colors = Colors[useColorScheme()];
  return (
    <RNSwitch
      trackColor={{ false: colors.separator, true: colors.brand }}
      thumbColor={colors.switchThumb}
      ios_backgroundColor={colors.separator}
      {...props}
    />
  );
}
