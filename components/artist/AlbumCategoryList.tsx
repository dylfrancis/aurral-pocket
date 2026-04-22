import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import type { PrimaryReleaseType } from "@/lib/types/library";

const MAX_VISIBLE = 10;

type AlbumCategoryListProps<T> = {
  type: PrimaryReleaseType;
  label: string;
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactElement;
  onNavigate?: (type: PrimaryReleaseType, label: string) => void;
};

export function AlbumCategoryList<T>({
  type,
  label,
  items,
  keyExtractor,
  renderItem,
  onNavigate,
}: AlbumCategoryListProps<T>) {
  const colors = Colors[useColorScheme()];

  if (items.length === 0) return null;

  const visible = items.slice(0, MAX_VISIBLE);
  const hasMore = items.length > MAX_VISIBLE;

  const handleNavigate = onNavigate ? () => onNavigate(type, label) : undefined;

  return (
    <View style={styles.container}>
      <SectionHeader
        title={label}
        count={items.length}
        onNavigate={handleNavigate}
      />
      <FlatList
        horizontal
        data={visible}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => renderItem(item)}
        ListFooterComponent={
          hasMore && onNavigate
            ? () => (
                <Pressable
                  onPress={() => onNavigate(type, label)}
                  style={({ pressed }) => [
                    styles.viewAllCard,
                    {
                      backgroundColor: colors.card,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="grid-outline"
                    size={24}
                    color={colors.brand}
                  />
                  <Text variant="caption" style={{ color: colors.brand }}>
                    View All
                  </Text>
                </Pressable>
              )
            : undefined
        }
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  list: {
    paddingHorizontal: 16,
  },
  viewAllCard: {
    width: 150,
    height: 150,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginRight: 12,
  },
});
