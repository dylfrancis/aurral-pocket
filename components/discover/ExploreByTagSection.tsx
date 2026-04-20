import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { useDiscovery } from "@/hooks/discover";
import { Skeleton } from "@/components/ui/Skeleton";
import { TagPill } from "@/components/ui/TagPill";

type ExploreByTagSectionProps = {
  onTagPress: (tag: string) => void;
};

export function ExploreByTagSection({ onTagPress }: ExploreByTagSectionProps) {
  const colors = Colors[useColorScheme()];
  const { data, isLoading } = useDiscovery();

  const tags = data?.topTags ?? [];

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text
          variant="caption"
          style={[styles.label, { color: colors.subtle }]}
        >
          Explore By Tag
        </Text>
        <View style={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} width={80} height={24} borderRadius={12} />
          ))}
        </View>
      </View>
    );
  }

  if (tags.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text variant="caption" style={[styles.label, { color: colors.subtle }]}>
        Explore By Tag
      </Text>
      <View style={styles.grid}>
        {tags.map((tag) => (
          <TagPill key={tag} name={tag} onPress={onTagPress} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  label: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
});
