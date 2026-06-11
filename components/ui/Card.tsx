import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

type CardProps = Omit<PressableProps, "style" | "children"> & {
  children?: React.ReactNode;
  /** Corner radius. Defaults to 12, the app-wide card standard. */
  radius?: number;
  /** Hairline outline using the separator color. */
  bordered?: boolean;
  /** Use the elevated (surfaceMid) background instead of card. */
  elevated?: boolean;
  /** Opacity while pressed. Only applies when onPress is provided. */
  pressedOpacity?: number;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  radius = 12,
  bordered = false,
  elevated = false,
  pressedOpacity = 0.8,
  style,
  onPress,
  onLongPress,
  children,
  ...rest
}: CardProps) {
  const colors = Colors[useColorScheme()];

  const baseStyle: ViewStyle = {
    backgroundColor: elevated ? colors.surfaceMid : colors.card,
    borderRadius: radius,
    ...(bordered && {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.separator,
    }),
  };

  if (!onPress && !onLongPress) {
    return (
      <View style={[baseStyle, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        baseStyle,
        { opacity: pressed ? pressedOpacity : 1 },
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
