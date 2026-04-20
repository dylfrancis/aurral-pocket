import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { TagPill } from "@/components/ui/TagPill";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { useDiscovery } from "@/hooks/discover";
import { formatBasedOn, formatUpdatedAt } from "@/lib/discover/format";

type Props = {
  onTagPress: (tag: string) => void;
};

export function DiscoverHeaderSection({ onTagPress }: Props) {
  const colors = Colors[useColorScheme()];
  const { data } = useDiscovery();

  if (!data || data.configured === false) return null;

  // "Top Tags" label intentionally renders `topGenres` — `topTags` drives the
  // separate "Explore by Tag" section. Parent aurral web app splits them the
  // same way (DiscoverPage "Top Tags" block pulls from topGenres).
  const tags = data.topGenres ?? [];
  const updatedLabel = formatUpdatedAt(data.lastUpdated);
  const basedOnLabel = formatBasedOn(data.basedOn ?? []);

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
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

      {tags.length > 0 ? (
        <View style={styles.tagsBlock}>
          <Text
            variant="caption"
            style={[styles.label, { color: colors.subtle }]}
          >
            Top Tags
          </Text>
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
  label: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingHorizontal: 16,
  },
  tagList: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  basedOn: {
    paddingHorizontal: 16,
    fontSize: 12,
  },
});
