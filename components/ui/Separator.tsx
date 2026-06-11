import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

type SeparatorProps = {
  style?: StyleProp<ViewStyle>;
};

/** Hairline divider. The single home for divider treatment app-wide. */
export function Separator({ style }: SeparatorProps) {
  const colors = Colors[useColorScheme()];
  return (
    <View style={[styles.line, { backgroundColor: colors.separator }, style]} />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
  },
});
