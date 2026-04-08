import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import BottomSheet from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenCenter } from '@/components/ui/ScreenCenter';
import { ArtistHero } from '@/components/library/ArtistHero';
import { AlbumRow } from '@/components/library/AlbumRow';
import { AlbumSheet } from '@/components/library/AlbumSheet';
import { ArtistActionSheet } from '@/components/library/ArtistActionSheet';
import { ArtistTags } from '@/components/library/ArtistTags';
import { EmptyState } from '@/components/library/EmptyState';
import { CollapsibleSection } from '@/components/library/CollapsibleSection';
import { SecondaryTypeFilter } from '@/components/library/SecondaryTypeFilter';
import { useLibraryArtist } from '@/hooks/library/use-library-artist';
import { useLibraryAlbums } from '@/hooks/library/use-library-albums';
import { useAlbumsWithTypes } from '@/hooks/library/use-albums-with-types';
import { useReleaseTypeFilter, matchesFilter } from '@/hooks/library/use-release-type-filter';
import { deleteLibraryArtist } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Album, PrimaryReleaseType } from '@/lib/types/library';

function sortByDate(albums: Album[]): Album[] {
  return albums.slice().sort((a, b) => {
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
  });
}

const CATEGORIES: { type: PrimaryReleaseType; label: string }[] = [
  { type: 'Album', label: 'Albums' },
  { type: 'EP', label: 'EPs' },
  { type: 'Single', label: 'Singles' },
];

export default function ArtistDetailScreen() {
  const { mbid } = useLocalSearchParams<{ mbid: string }>();
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();

  const {
    data: artist,
    isLoading: artistLoading,
    error: artistError,
    refetch: refetchArtist,
  } = useLibraryArtist(mbid);

  const {
    data: rawAlbums,
    isLoading: albumsLoading,
    error: albumsError,
    refetch: refetchAlbums,
  } = useLibraryAlbums(artist?.id);

  const { albums: typedAlbums, isLoadingTypes } = useAlbumsWithTypes(artist?.mbid, rawAlbums);
  const filter = useReleaseTypeFilter();

  const filtered = useMemo(
    () => typedAlbums?.filter((a) => matchesFilter(a, filter.selected)),
    [typedAlbums, filter.selected],
  );

  const grouped = useMemo(() => {
    if (!filtered) return null;
    const map = new Map<PrimaryReleaseType, Album[]>();
    for (const album of filtered) {
      const type = album.albumType ?? 'Album';
      const list = map.get(type) ?? [];
      list.push(album);
      map.set(type, list);
    }
    // Sort within each group
    for (const [key, list] of map) {
      map.set(key, sortByDate(list));
    }
    return map;
  }, [filtered]);

  const router = useRouter();
  const queryClient = useQueryClient();
  const albumSheetRef = useRef<BottomSheet>(null);
  const artistSheetRef = useRef<BottomSheet>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const openAlbum = useCallback((album: Album) => {
    setSelectedAlbum(album);
    albumSheetRef.current?.snapToIndex(0);
  }, []);

  const openArtistInfo = useCallback(() => {
    artistSheetRef.current?.snapToIndex(0);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (mbid: string) => deleteLibraryArtist(mbid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.artists() });
      router.back();
    },
  });

  const handleBadgePress = useCallback(() => {
    if (!artist) return;
    Alert.alert(
      'Remove from Library',
      `Remove "${artist.artistName}" and all their albums from your library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(artist.mbid),
        },
      ],
    );
  }, [artist, deleteMutation]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchArtist(), refetchAlbums()]);
    setRefreshing(false);
  }, [refetchArtist, refetchAlbums]);

  if (artistLoading) {
    return <ScreenCenter loading />;
  }

  if (artistError) {
    return (
      <ScreenCenter>
        <EmptyState
          icon="cloud-offline-outline"
          message="Failed to load artist"
          actionLabel="Try Again"
          onAction={() => refetchArtist()}
        />
      </ScreenCenter>
    );
  }

  if (!artist) {
    return (
      <ScreenCenter>
        <EmptyState icon="alert-circle-outline" message="Artist not found" />
      </ScreenCenter>
    );
  }

  const hasSecondaryTypes = typedAlbums?.some(
    (a) => a.secondaryTypes && a.secondaryTypes.length > 0,
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
          />
        }
      >
        <ArtistHero
          artist={artist}
          scrollY={scrollY}
          refreshing={refreshing}
          onBadgePress={handleBadgePress}
          onInfoPress={openArtistInfo}
        />

        <ArtistTags mbid={artist.mbid} />

        {hasSecondaryTypes && (
          <SecondaryTypeFilter
            selected={filter.selected}
            onToggle={filter.toggleSecondary}
          />
        )}

        <View style={styles.albumsSection}>
          {albumsLoading || isLoadingTypes ? (
            <ActivityIndicator style={styles.loader} color={colors.brand} />
          ) : albumsError ? (
            <EmptyState
              icon="cloud-offline-outline"
              message="Failed to load albums"
              actionLabel="Try Again"
              onAction={() => refetchAlbums()}
            />
          ) : grouped && grouped.size > 0 ? (
            CATEGORIES.map(({ type, label }) => {
              const list = grouped.get(type);
              if (!list || list.length === 0) return null;
              return (
                <CollapsibleSection key={type} title={label} count={list.length}>
                  {list.map((album) => (
                    <AlbumRow
                      key={album.id}
                      album={album}
                      onPress={() => openAlbum(album)}
                    />
                  ))}
                </CollapsibleSection>
              );
            })
          ) : (
            <EmptyState icon="disc-outline" message="No albums in library" />
          )}
        </View>
      </Animated.ScrollView>

      <AlbumSheet
        album={selectedAlbum}
        artistName={artist.artistName}
        sheetRef={albumSheetRef}
        onDeleted={() => setSelectedAlbum(null)}
      />

      <ArtistActionSheet
        artist={artist}
        sheetRef={artistSheetRef}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {},
  albumsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loader: {
    paddingVertical: 32,
  },
});
