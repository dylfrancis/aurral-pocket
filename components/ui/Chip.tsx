import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts, Radius } from "@/constants/theme";

type ChipVariant = "brand" | "subtle" | "error" | "neutral";
type ChipSize = "sm" | "md";

type ChipProps = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: ChipVariant;
  size?: ChipSize;
  /** Tap handler. When set, the chip becomes Pressable. */
  onPress?: () => void;
  /** When set, renders a trailing X button that calls this handler. */
  onRemove?: () => void;
  /** Replaces the leading icon with a spinner. */
  loading?: boolean;
  /** Visually dims and disables interaction. */
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function Chip({
  label,
  icon,
  variant = "subtle",
  size = "sm",
  onPress,
  onRemove,
  loading,
  disabled,
  accessibilityLabel,
}: ChipProps) {
  const colors = Colors[useColorScheme()];

  const variantStyles: Record<ChipVariant, { bg: string; fg: string }> = {
    brand: { bg: colors.brandMuted, fg: colors.brandStrong },
    subtle: { bg: colors.separator, fg: colors.subtle },
    error: { bg: `${colors.error}20`, fg: colors.error },
    neutral: { bg: colors.card, fg: colors.text },
  };
  const { bg, fg } = variantStyles[variant];
  const sizing = size === "md" ? sizeMd : sizeSm;
  const iconSize = size === "md" ? 16 : 13;
  const inactive = disabled || loading;

  const body = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Ionicons name={icon} size={iconSize} color={fg} />
      ) : null}
      <Text
        variant="caption"
        style={[
          sizing.label,
          { color: variant === "neutral" ? colors.text : fg },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          disabled={inactive}
          style={({ pressed }) => pressed && styles.removePressed}
        >
          <Ionicons
            name="close-circle"
            size={iconSize + 3}
            color={colors.subtle}
          />
        </Pressable>
      ) : null}
    </>
  );

  const containerStyle = [sizing.chip, { backgroundColor: bg }];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        style={({ pressed }) => [
          containerStyle,
          inactive && styles.disabled,
          pressed && !inactive && styles.pressed,
        ]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={[containerStyle, inactive && styles.disabled]}>{body}</View>
  );
}

const sizeSm = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.round,
    gap: 5,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.semiBold,
  },
});

const sizeMd = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.round,
    gap: 6,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.medium,
  },
});

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  removePressed: {
    opacity: 0.5,
  },
});
