import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
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

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onNavigate ? () => onNavigate(type, label) : undefined}
        disabled={!onNavigate}
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text variant="subtitle" style={[styles.title, { color: colors.text }]}>
          {label}
          <Text variant="caption" style={{ color: colors.subtle }}>
            {"  "}
            {items.length}
          </Text>
        </Text>
        {onNavigate && (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.subtle}
            style={{ marginLeft: 4 }}
          />
        )}
      </Pressable>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
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
