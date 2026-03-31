import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { ArtistHero } from '@/components/library/ArtistHero';
import { AlbumRow } from '@/components/library/AlbumRow';
import { AlbumSheet } from '@/components/library/AlbumSheet';
import { EmptyState } from '@/components/library/EmptyState';
import { useLibraryArtist } from '@/hooks/library/use-library-artist';
import { useLibraryAlbums } from '@/hooks/library/use-library-albums';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { Album } from '@/lib/types/library';

export default function ArtistDetailScreen() {
  const { mbid } = useLocalSearchParams<{ mbid: string }>();
  const colors = Colors[useColorScheme()];
  const { data: artist, isLoading: artistLoading, error: artistError, refetch: refetchArtist } = useLibraryArtist(mbid);
  const insets = useSafeAreaInsets();
  const { data: rawAlbums, isLoading: albumsLoading, error: albumsError, refetch: refetchAlbums } = useLibraryAlbums(artist?.id);
  const albums = useMemo(
    () =>
      rawAlbums?.slice().sort((a, b) => {
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      }),
    [rawAlbums],
  );

  const sheetRef = useRef<BottomSheet>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const openAlbum = useCallback((album: Album) => {
    setSelectedAlbum(album);
    sheetRef.current?.snapToIndex(0);
  }, []);

  if (artistLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (artistError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="cloud-offline-outline"
          message="Failed to load artist"
          actionLabel="Try Again"
          onAction={() => refetchArtist()}
        />
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        <ArtistHero artist={artist} />

        <View style={styles.albumsSection}>
          <Text variant="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
            Albums{albums && albums.length > 0 ? ` (${albums.length})` : ''}
          </Text>

          {albumsLoading ? (
            <ActivityIndicator style={styles.loader} color={colors.brand} />
          ) : albumsError ? (
            <EmptyState
              icon="cloud-offline-outline"
              message="Failed to load albums"
              actionLabel="Try Again"
              onAction={() => refetchAlbums()}
            />
          ) : albums && albums.length > 0 ? (
            albums.map((album) => (
              <AlbumRow key={album.id} album={album} onPress={() => openAlbum(album)} />
            ))
          ) : (
            <EmptyState icon="disc-outline" message="No albums in library" />
          )}
        </View>
      </ScrollView>

      <AlbumSheet
        album={selectedAlbum}
        artistName={artist.artistName}
        sheetRef={sheetRef}
        onDeleted={() => setSelectedAlbum(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {},
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
