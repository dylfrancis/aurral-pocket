import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useArtistDetails } from '@/hooks/library/use-artist-details';
import { getTagColor } from '@/lib/tag-colors';
import { Fonts } from '@/constants/theme';

type ArtistTagsProps = {
  mbid: string;
};

export function ArtistTags({ mbid }: ArtistTagsProps) {
  const { data } = useArtistDetails(mbid);
  const tags = data?.tags;

  if (!tags || tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {tags.map((tag) => (
        <View
          key={tag.name}
          style={[styles.tag, { backgroundColor: getTagColor(tag.name) }]}
        >
          <Text variant="caption" style={styles.label}>
            #{tag.name}
          </Text>
        </View>
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
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
});
