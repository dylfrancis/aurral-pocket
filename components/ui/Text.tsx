import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
  StyleSheet,
} from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type Variant = "title" | "subtitle" | "body" | "caption" | "error";

interface TextProps extends RNTextProps {
  variant?: Variant;
}

const variantStyles = StyleSheet.create({
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});

const variantFonts: Record<Variant, TextStyle> = {
  title: Fonts.bold,
  subtitle: Fonts.regular,
  body: Fonts.regular,
  caption: Fonts.regular,
  error: Fonts.regular,
};

export function Text({ variant = "body", style, ...rest }: TextProps) {
  const colors = Colors[useColorScheme()];

  const color =
    variant === "error"
      ? colors.error
      : variant === "subtitle" || variant === "caption"
        ? colors.subtle
        : colors.text;

  return (
    <RNText
      style={[variantStyles[variant], variantFonts[variant], { color }, style]}
      {...rest}
    />
  );
}
