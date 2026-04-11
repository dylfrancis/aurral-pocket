import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type SearchPreviewRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  trailing?: React.ReactNode;
  onPress: () => void;
};

export const SearchPreviewRow = React.memo(function SearchPreviewRow({
  icon,
  iconColor,
  label,
  trailing,
  onPress,
}: SearchPreviewRowProps) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={16} color={iconColor ?? colors.subtle} />
      <Text
        variant="body"
        numberOfLines={1}
        style={[styles.label, { color: colors.text }]}
      >
        {label}
      </Text>
      {trailing ?? (
        <Ionicons
          name="arrow-forward-outline"
          size={16}
          color={colors.subtle}
        />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  label: {
    flex: 1,
    fontFamily: Fonts.medium,
  },
});
