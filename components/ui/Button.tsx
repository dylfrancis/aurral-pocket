import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  title: string;
  loading?: boolean;
  variant?: "primary" | "inline";
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  loading = false,
  disabled,
  variant = "primary",
  style,
  ...rest
}: ButtonProps) {
  const colors = Colors[useColorScheme()];
  const isDisabled = disabled || loading;

  if (variant === "inline") {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.inline,
          pressed && styles.pressed,
          style,
        ]}
        disabled={isDisabled}
        {...rest}
      >
        <Text
          variant="body"
          style={{ color: colors.brand, fontFamily: Fonts.medium }}
        >
          {title}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: colors.buttonPrimary },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.buttonPrimaryText} />
      ) : (
        <Text
          variant="body"
          style={[
            styles.primaryText,
            { color: colors.buttonPrimaryText, fontFamily: Fonts.semiBold },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontSize: 17,
  },
  disabled: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.6,
  },
  inline: {
    padding: 8,
  },
});
