import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { SearchPreviewRow } from "@/components/search/SearchPreviewRow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { RecentSearch } from "@/hooks/search/use-recent-searches";

const ICONS: Record<RecentSearch["type"], keyof typeof Ionicons.glyphMap> = {
  query: "time-outline",
  artist: "person-outline",
  tag: "pricetag-outline",
};

type RecentSearchesProps = {
  searches: RecentSearch[];
  onSelect: (entry: RecentSearch) => void;
  onRemove: (entry: RecentSearch) => void;
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
      {searches.map((entry, i) => {
        const label = entry.type === "tag" ? `#${entry.text}` : entry.text;
        return (
          <SearchPreviewRow
            key={`${entry.type}-${entry.type === "artist" ? entry.mbid : entry.text}-${i}`}
            icon={ICONS[entry.type]}
            iconColor={
              entry.type === "query" ? colors.subtle : colors.brandStrong
            }
            label={label}
            onPress={() => onSelect(entry)}
            trailing={
              <Pressable onPress={() => onRemove(entry)} hitSlop={8}>
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
