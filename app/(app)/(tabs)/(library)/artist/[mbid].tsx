import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { ArtistHero } from '@/components/library/ArtistHero';
import { AlbumAccordion } from '@/components/library/AlbumAccordion';
import { EmptyState } from '@/components/library/EmptyState';
import { useLibraryArtist } from '@/hooks/library/use-library-artist';
import { useLibraryAlbums } from '@/hooks/library/use-library-albums';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

export default function ArtistDetailScreen() {
  const { mbid } = useLocalSearchParams<{ mbid: string }>();
  const colors = Colors[useColorScheme()];
  const { data: artist, isLoading: artistLoading } = useLibraryArtist(mbid);
  const { data: albums, isLoading: albumsLoading } = useLibraryAlbums(artist?.id);

  if (artistLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!artist) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle-outline" message="Artist not found" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <ArtistHero artist={artist} />

      <View style={styles.albumsSection}>
        <Text variant="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
          Albums{albums ? ` (${albums.length})` : ''}
        </Text>

        {albumsLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.brand} />
        ) : albums && albums.length > 0 ? (
          albums.map((album) => (
            <AlbumAccordion key={album.id} album={album} />
          ))
        ) : (
          <EmptyState icon="disc-outline" message="No albums in library" />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 32,
  },
  albumsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    marginBottom: 12,
  },
  loader: {
    paddingVertical: 32,
  },
});
