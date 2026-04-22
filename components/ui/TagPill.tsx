import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { getTagColor } from "@/lib/tag-colors";

export type TagPillProps = {
  name: string;
  onPress?: (tag: string) => void;
};

export function TagPill({ name, onPress }: TagPillProps) {
  const color = getTagColor(name);
  const label = (
    <Text variant="caption" style={styles.label}>
      #{name}
    </Text>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          onPress(name);
        }}
        style={({ pressed }) => [
          styles.tag,
          { backgroundColor: color, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {label}
      </Pressable>
    );
  }

  return <View style={[styles.tag, { backgroundColor: color }]}>{label}</View>;
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
});
