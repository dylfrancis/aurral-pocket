import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type TextStyle } from "react-native";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

/** The small uppercase heading over a section of a page. */
export function SectionLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const colors = useColors();
  return (
    <Text
      variant="caption"
      style={[styles.label, { color: colors.subtle }, style]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingVertical: 8,
  },
});
