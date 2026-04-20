import { ScrollView, StyleSheet } from "react-native";
import { useArtistDetailsStream } from "@/hooks/library/use-artist-details-stream";
import { ArtistTagsSkeleton } from "@/components/library/ArtistTagsSkeleton";
import { TagPill } from "@/components/ui/TagPill";

type ArtistTagsProps = {
  mbid: string;
};

export function ArtistTags({ mbid }: ArtistTagsProps) {
  const { data, isLoading } = useArtistDetailsStream(mbid);
  const tags = data?.tags;

  if (isLoading) return <ArtistTagsSkeleton />;
  if (!tags || tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {tags.map((tag) => (
        <TagPill key={tag.name} name={tag.name} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
