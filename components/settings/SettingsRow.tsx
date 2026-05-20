import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type SettingsRowProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
};

export function SettingsRow({
  icon,
  label,
  value,
  trailing,
  onPress,
  showChevron,
  destructive,
}: SettingsRowProps) {
  const colors = Colors[useColorScheme()];
  const labelColor = destructive ? colors.error : colors.text;
  const iconColor = destructive ? colors.error : colors.subtle;

  const content = (
    <View style={styles.row}>
      {icon ? (
        <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />
      ) : null}
      <View style={styles.labelGroup}>
        <Text
          variant="body"
          style={[
            styles.label,
            { color: labelColor, fontFamily: Fonts.medium },
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={styles.trailing}>
        {value ? (
          <Text
            variant="body"
            style={{ color: colors.subtle }}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
        {trailing}
        {showChevron ? (
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  icon: {
    width: 22,
  },
  labelGroup: {
    flex: 1,
  },
  label: {
    fontSize: 15,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
