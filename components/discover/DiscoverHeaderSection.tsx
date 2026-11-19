import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { TagPill } from "@/components/ui/TagPill";
import { useDiscovery } from "@/hooks/discover";
import { formatBasedOn } from "@/lib/discover/format";
import { useColors } from "@/hooks/use-colors";

type Props = {
  onTagPress: (tag: string) => void;
};

export function DiscoverHeaderSection({ onTagPress }: Props) {
  const colors = useColors();
  const { data, isLoading } = useDiscovery();

  if (data?.configured === false) return null;

  if (!data) {
    if (!isLoading) return null;
    return (
      <View style={styles.container}>
        <View style={styles.tagsBlock}>
          <SectionHeader title="Top Tags" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagList}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} width={72} height={30} borderRadius={12} />
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  // "Top Tags" label intentionally renders `topGenres` — `topTags` drives the
  // separate "Explore by Tag" section. Parent aurral web app splits them the
  // same way (DiscoverPage "Top Tags" block pulls from topGenres).
  const tags = data.topGenres ?? [];
  const basedOnLabel = formatBasedOn(data.basedOn ?? []);

  return (
    <View style={styles.container}>
      {tags.length > 0 ? (
        <View style={styles.tagsBlock}>
          <SectionHeader title="Top Tags" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagList}
          >
            {tags.map((tag) => (
              <TagPill key={tag} name={tag} onPress={onTagPress} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {basedOnLabel ? (
        <Text
          variant="caption"
          style={[styles.basedOn, { color: colors.subtle }]}
        >
          {basedOnLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  tagsBlock: {
    gap: 4,
  },
  tagList: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  basedOn: {
    paddingHorizontal: 16,
    fontSize: 12,
  },
});
