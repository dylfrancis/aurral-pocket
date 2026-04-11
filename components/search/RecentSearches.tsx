import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { SearchPreviewRow } from "@/components/search/SearchPreviewRow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type RecentSearchesProps = {
  searches: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
};

export function RecentSearches({
  searches,
  onSelect,
  onRemove,
  onClear,
}: RecentSearchesProps) {
  const colors = Colors[useColorScheme()];

  if (searches.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text
          variant="caption"
          style={[styles.title, { color: colors.subtle }]}
        >
          Recent Searches
        </Text>
        <Pressable onPress={onClear} hitSlop={8}>
          <Text variant="caption" style={{ color: colors.brand }}>
            Clear
          </Text>
        </Pressable>
      </View>
      {searches.map((query) => {
        const isTag = query.startsWith("#");
        return (
          <SearchPreviewRow
            key={query}
            icon={isTag ? "pricetag-outline" : "time-outline"}
            iconColor={isTag ? colors.brandStrong : colors.subtle}
            label={query}
            onPress={() => onSelect(query)}
            trailing={
              <Pressable onPress={() => onRemove(query)} hitSlop={8}>
                <Ionicons name="close" size={16} color={colors.subtle} />
              </Pressable>
            }
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  title: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 13,
  },
});
