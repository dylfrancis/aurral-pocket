import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { Fonts, Radius } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

export type TagPillProps = {
  name: string;
  onPress?: (tag: string) => void;
};

export function TagPill({ name, onPress }: TagPillProps) {
  const colors = useColors();
  const label = (
    <Text
      variant="caption"
      numberOfLines={1}
      style={[styles.label, { color: colors.text }]}
    >
      #{name}
    </Text>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void Haptics.selectionAsync();
          onPress(name);
        }}
        style={({ pressed }) => [
          styles.tag,
          {
            backgroundColor: pressed ? colors.tagFillPressed : colors.tagFill,
          },
        ]}
      >
        {label}
      </Pressable>
    );
  }

  return (
    <View style={[styles.tag, { backgroundColor: colors.tagFill }]}>
      {label}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: Radius.round,
  },
  label: {
    ...Fonts.medium,
  },
});
