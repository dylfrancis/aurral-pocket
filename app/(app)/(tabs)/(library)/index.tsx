import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type Category = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: Href;
};

/**
 * The library home is a category list: every row pushes a screen, and the home
 * itself reads nothing. With no query there is no spinner and no failure state
 * on the tab's first paint, however large the library is.
 *
 * Albums, Genres and Favorites join the list as their screens ship — issues
 * #238, #239 and #240. A row lands here only once its route exists, so the
 * list never offers a destination that cannot open.
 */
const CATEGORIES: Category[] = [
  { icon: "people-outline", label: "Artists", route: "/artists" },
];

const ICON_SIZE = 22;

export default function LibraryScreen() {
  const router = useRouter();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      {CATEGORIES.map((category, index) => (
        <CategoryRow
          key={category.label}
          category={category}
          // The last row drops its separator, so the list does not end on a
          // hairline hanging under nothing.
          separator={index < CATEGORIES.length - 1}
          onPress={() => router.push(category.route)}
        />
      ))}
    </ScrollView>
  );
}

function CategoryRow({
  category,
  separator,
  onPress,
}: {
  category: Category;
  separator: boolean;
  onPress: () => void;
}) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.6 : 1 },
        separator && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
      ]}
    >
      <Ionicons name={category.icon} size={ICON_SIZE} color={colors.brand} />
      <Text variant="body" style={[styles.label, { color: colors.text }]}>
        {category.label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 16,
    gap: 14,
  },
  label: {
    flex: 1,
    fontSize: 17,
    ...Fonts.medium,
  },
});
