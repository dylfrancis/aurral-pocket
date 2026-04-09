import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import BottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenCenter } from '@/components/ui/ScreenCenter';
import { ArtistHero } from '@/components/library/ArtistHero';
import { AlbumCard } from '@/components/library/AlbumCard';
import { ReleaseGroupCard } from '@/components/library/ReleaseGroupCard';
import { AlbumSheet } from '@/components/library/AlbumSheet';
import { ReleaseGroupSheet } from '@/components/library/ReleaseGroupSheet';
import { ArtistTags } from '@/components/library/ArtistTags';
import { ArtistInfoSection } from '@/components/library/ArtistInfoSection';
import { PreviewTrackRow } from '@/components/library/PreviewTrackRow';
import { EmptyState } from '@/components/library/EmptyState';
import { Text } from '@/components/ui/Text';
import { useLibraryArtist } from '@/hooks/library/use-library-artist';
import { useLibraryAlbums } from '@/hooks/library/use-library-albums';
import { useAlbumsWithTypes } from '@/hooks/library/use-albums-with-types';
import { usePreviewPlayer } from '@/hooks/library/use-preview-player';
import { useDownloadStatuses } from '@/hooks/library/use-download-statuses';
import { deleteLibraryArtist, addLibraryAlbum } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import type { Album, PrimaryReleaseType, ReleaseGroup } from '@/lib/types/library';

function sortByDate(albums: Album[]): Album[] {
  return albums.slice().sort((a, b) => {
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
  });
}

function sortReleaseGroupsByDate(rgs: ReleaseGroup[]): ReleaseGroup[] {
  return rgs.slice().sort((a, b) => {
    if (!a['first-release-date']) return 1;
    if (!b['first-release-date']) return -1;
    return new Date(b['first-release-date']).getTime() - new Date(a['first-release-date']).getTime();
  });
}

const CATEGORIES: { type: PrimaryReleaseType; label: string }[] = [
  { type: 'Album', label: 'Albums' },
  { type: 'EP', label: 'EPs' },
  { type: 'Single', label: 'Singles' },
];

const MAX_VISIBLE = 10;

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

  const { albums: typedAlbums, otherReleases, isLoadingTypes } = useAlbumsWithTypes(artist?.mbid, rawAlbums);
  const { data: downloadStatuses } = useDownloadStatuses(rawAlbums);
  const { stop: stopPreview, ...preview } = usePreviewPlayer(artist?.mbid, artist?.artistName);

  const grouped = useMemo(() => {
    if (!typedAlbums) return null;
    const map = new Map<PrimaryReleaseType, Album[]>();
    for (const album of typedAlbums) {
      const type = album.albumType ?? 'Album';
      const list = map.get(type) ?? [];
      list.push(album);
      map.set(type, list);
    }
    for (const [key, list] of map) {
      map.set(key, sortByDate(list));
    }
    return map;
  }, [typedAlbums]);

  const groupedReleases = useMemo(() => {
    if (!otherReleases) return null;
    const map = new Map<PrimaryReleaseType, ReleaseGroup[]>();
    for (const rg of otherReleases) {
      const type = (rg['primary-type'] ?? 'Album') as PrimaryReleaseType;
      if (!CATEGORIES.some((c) => c.type === type)) continue;
      const list = map.get(type) ?? [];
      list.push(rg);
      map.set(type, list);
    }
    for (const [key, list] of map) {
      map.set(key, sortReleaseGroupsByDate(list));
    }
    return map;
  }, [otherReleases]);

  const router = useRouter();
  const queryClient = useQueryClient();
  const albumSheetRef = useRef<BottomSheet>(null);
  const releaseGroupSheetRef = useRef<BottomSheet>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedReleaseGroup, setSelectedReleaseGroup] = useState<ReleaseGroup | null>(null);

  const openAlbum = useCallback((album: Album) => {
    setSelectedAlbum(album);
    albumSheetRef.current?.snapToIndex(0);
  }, []);

  const openReleaseGroup = useCallback((rg: ReleaseGroup) => {
    stopPreview();
    setSelectedReleaseGroup(rg);
    releaseGroupSheetRef.current?.snapToIndex(0);
  }, [stopPreview]);

  const deleteMutation = useMutation({
    mutationFn: (mbid: string) => deleteLibraryArtist(mbid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.artists() });
      router.back();
    },
  });

  const handleBadgePress = useCallback(() => {
    if (!artist) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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

  const allReleaseGroups = useMemo(() => {
    if (!otherReleases) return [];
    return otherReleases.filter((rg) => {
      const type = rg['primary-type'] as PrimaryReleaseType;
      return CATEGORIES.some((c) => c.type === type);
    });
  }, [otherReleases]);

  const addAllMutation = useMutation({
    mutationFn: async () => {
      if (!artist) return;
      await Promise.all(
        allReleaseGroups.map((rg) => addLibraryAlbum(artist.id, rg.id, rg.title)),
      );
    },
    onSuccess: () => {
      if (artist) {
        queryClient.invalidateQueries({ queryKey: libraryKeys.albums(artist.id) });
      }
    },
  });

  const navigateToAlbums = useCallback(
    (type: PrimaryReleaseType, label: string) => {
      if (!artist) return;
      router.push({
        pathname: '/artist/albums',
        params: {
          artistId: artist.id,
          artistMbid: artist.mbid,
          albumType: type,
          title: label,
          artistName: artist.artistName,
        },
      });
    },
    [router, artist],
  );

  const navigateToReleases = useCallback(
    (type: PrimaryReleaseType, label: string) => {
      if (!artist) return;
      router.push({
        pathname: '/artist/releases',
        params: {
          artistId: artist.id,
          artistMbid: artist.mbid,
          albumType: type,
          title: label,
          artistName: artist.artistName,
        },
      });
    },
    [router, artist],
  );

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
        />

        <ArtistTags mbid={artist.mbid} />

        {/* Top Tracks */}
        {preview.tracks && preview.tracks.length > 0 && (
          <View style={styles.topTracksSection}>
            <Text variant="caption" style={[styles.sectionLabel, { color: colors.subtle }]}>
              Top Tracks
            </Text>
            {preview.tracks.map((track) => (
              <PreviewTrackRow
                key={track.id}
                track={track}
                isPlaying={preview.playingId === track.id}
                progress={preview.playingId === track.id ? preview.progress : 0}
                onToggle={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); preview.toggle(track); }}
              />
            ))}
          </View>
        )}

        {/* In Your Library */}
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
            <>
              <Text variant="caption" style={[styles.sectionLabel, styles.sectionLabelPadded, { color: colors.subtle }]}>
                In Your Library
              </Text>
              {CATEGORIES.map(({ type, label }) => {
                const list = grouped.get(type);
                if (!list || list.length === 0) return null;
                const visible = list.slice(0, MAX_VISIBLE);
                const hasMore = list.length > MAX_VISIBLE;
                return (
                  <View key={type} style={styles.categorySection}>
                    <Pressable
                      onPress={() => navigateToAlbums(type, label)}
                      style={({ pressed }) => [
                        styles.categoryHeader,
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                    >
                      <Text variant="subtitle" style={[styles.categoryTitle, { color: colors.text }]}>
                        {label}
                        <Text variant="caption" style={{ color: colors.subtle }}>
                          {'  '}{list.length}
                        </Text>
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.subtle} style={{ marginLeft: 4 }} />
                    </Pressable>
                    <FlatList
                      horizontal
                      data={visible}
                      keyExtractor={(album) => album.id}
                      renderItem={({ item }) => (
                        <AlbumCard album={item} onPress={() => openAlbum(item)} downloadStatus={downloadStatuses?.[item.id]?.status} />
                      )}
                      ListFooterComponent={
                        hasMore
                          ? () => (
                              <Pressable
                                onPress={() => navigateToAlbums(type, label)}
                                style={({ pressed }) => [
                                  styles.viewAllCard,
                                  { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
                                ]}
                              >
                                <Ionicons name="grid-outline" size={24} color={colors.brand} />
                                <Text variant="caption" style={{ color: colors.brand }}>
                                  View All
                                </Text>
                              </Pressable>
                            )
                          : undefined
                      }
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.albumList}
                    />
                  </View>
                );
              })}
            </>
          ) : (
            <EmptyState icon="disc-outline" message="No albums in library" />
          )}
        </View>

        {/* Albums & Releases (not in library) */}
        {groupedReleases && groupedReleases.size > 0 && (
          <View style={styles.albumsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text variant="caption" style={[styles.sectionLabel, { color: colors.subtle }]}>
                Albums & Releases
              </Text>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); addAllMutation.mutate(); }}
                disabled={addAllMutation.isPending || addAllMutation.isSuccess}
                style={({ pressed }) => [
                  styles.addAllButton,
                  { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
                  addAllMutation.isSuccess && { backgroundColor: colors.subtle },
                ]}
              >
                {addAllMutation.isPending ? (
                  <ActivityIndicator size={14} color="#fff" />
                ) : (
                  <Ionicons
                    name={addAllMutation.isSuccess ? 'checkmark' : 'add'}
                    size={14}
                    color="#fff"
                  />
                )}
                <Text variant="caption" style={styles.addAllText}>
                  {addAllMutation.isSuccess ? 'Added' : 'Add All'}
                </Text>
              </Pressable>
            </View>
            {CATEGORIES.map(({ type, label }) => {
              const list = groupedReleases.get(type);
              if (!list || list.length === 0) return null;
              const visible = list.slice(0, MAX_VISIBLE);
              const hasMore = list.length > MAX_VISIBLE;
              return (
                <View key={`release-${type}`} style={styles.categorySection}>
                  <Pressable
                    onPress={() => navigateToReleases(type, label)}
                    style={({ pressed }) => [
                      styles.categoryHeader,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text variant="subtitle" style={[styles.categoryTitle, { color: colors.text }]}>
                      {label}
                      <Text variant="caption" style={{ color: colors.subtle }}>
                        {'  '}{list.length}
                      </Text>
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.subtle} style={{ marginLeft: 4 }} />
                  </Pressable>
                  <FlatList
                    horizontal
                    data={visible}
                    keyExtractor={(rg) => rg.id}
                    renderItem={({ item }) => (
                      <ReleaseGroupCard releaseGroup={item} onPress={() => openReleaseGroup(item)} />
                    )}
                    ListFooterComponent={
                      hasMore
                        ? () => (
                            <Pressable
                              onPress={() => navigateToReleases(type, label)}
                              style={({ pressed }) => [
                                styles.viewAllCard,
                                { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
                              ]}
                            >
                              <Ionicons name="grid-outline" size={24} color={colors.brand} />
                              <Text variant="caption" style={{ color: colors.brand }}>
                                View All
                              </Text>
                            </Pressable>
                          )
                        : undefined
                    }
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.albumList}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* Bio & Actions */}
        <ArtistInfoSection artist={artist} />
      </Animated.ScrollView>

      <AlbumSheet
        album={selectedAlbum}
        artistName={artist.artistName}
        sheetRef={albumSheetRef}
        onDeleted={() => setSelectedAlbum(null)}
        downloadStatus={selectedAlbum ? downloadStatuses?.[selectedAlbum.id]?.status : undefined}
      />

      <ReleaseGroupSheet
        releaseGroup={selectedReleaseGroup}
        artistId={artist.id}
        artistName={artist.artistName}
        sheetRef={releaseGroupSheetRef}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {},
  topTracksSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 8,
  },
  sectionLabelPadded: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  albumsSection: {
    paddingTop: 8,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  categoryTitle: {
    fontFamily: Fonts.semiBold,
  },
  albumList: {
    paddingHorizontal: 16,
  },
  viewAllCard: {
    width: 150,
    height: 150,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginRight: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  addAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addAllText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
  loader: {
    paddingVertical: 32,
  },
});
