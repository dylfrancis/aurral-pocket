import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { TagPill } from "@/components/ui/TagPill";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { useDiscovery } from "@/hooks/discover";
import { formatBasedOn, formatUpdatedAt } from "@/lib/discover/format";
import { useColors } from "@/hooks/use-colors";

type Props = {
  onTagPress: (tag: string) => void;
};

export function DiscoverHeaderSection({ onTagPress }: Props) {
  const colors = useColors();
  // Repaint the "updated" date when the server format changes.
  useDateTimeFormat();
  const { data, isLoading } = useDiscovery();

  if (data?.configured === false) return null;

  if (!data) {
    if (!isLoading) return null;
    return (
      <View style={styles.container}>
        <View style={styles.intro}>
          <View style={styles.introText}>
            <Text
              variant="body"
              style={[styles.subtitle, { color: colors.subtle }]}
            >
              Your daily mix, curated from your library.
            </Text>
          </View>
        </View>
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
  const updatedLabel = formatUpdatedAt(data.lastUpdated);
  const basedOnLabel = formatBasedOn(data.basedOn ?? []);

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <View style={styles.introText}>
          <Text
            variant="body"
            style={[styles.subtitle, { color: colors.subtle }]}
          >
            Your daily mix, curated from your library.
          </Text>
          {updatedLabel ? (
            <Text
              variant="caption"
              style={[styles.meta, { color: colors.subtle }]}
            >
              Updated {updatedLabel}
            </Text>
          ) : null}
        </View>
      </View>

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
  intro: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  introText: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
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
