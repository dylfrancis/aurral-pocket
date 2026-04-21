import React from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type TagSuggestionsProps = {
  tags: string[];
  onSelect: (tag: string) => void;
};

export const TagSuggestions = React.memo(function TagSuggestions({
  tags,
  onSelect,
}: TagSuggestionsProps) {
  const colors = Colors[useColorScheme()];

  if (tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {tags.map((tag) => (
        <Pressable
          key={tag}
          onPress={() => onSelect(tag)}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: colors.brandMuted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons
            name="pricetag-outline"
            size={13}
            color={colors.brandStrong}
          />
          <Text
            variant="caption"
            style={[styles.label, { color: colors.brandStrong }]}
          >
            {tag}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
});
