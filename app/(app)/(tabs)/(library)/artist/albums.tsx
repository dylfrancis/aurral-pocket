import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import BottomSheet from '@gorhom/bottom-sheet';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AlbumCard } from '@/components/library/AlbumCard';
import { AlbumSheet } from '@/components/library/AlbumSheet';
import { AlbumSortTrigger, AlbumSortSheet, ALBUM_SORT_OPTIONS, type AlbumSortMode } from '@/components/library/AlbumSortPicker';
import { useLibraryAlbums } from '@/hooks/library/use-library-albums';
import { useAlbumsWithTypes } from '@/hooks/library/use-albums-with-types';
import { useDownloadStatuses } from '@/hooks/library/use-download-statuses';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { stripArticle } from '@/lib/strings';
import type { Album, PrimaryReleaseType } from '@/lib/types/library';

const EDGE_PADDING = 12;
const CARD_GAP = 12;
const NUM_COLUMNS = 2;
const IS_IOS = Platform.OS === 'ios';

function sortAlbums(albums: Album[], mode: AlbumSortMode): Album[] {
  const list = albums.slice();
  switch (mode) {
    case 'date-desc':
      return list.sort((a, b) => {
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      });
    case 'date-asc':
      return list.sort((a, b) => {
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
      });
    case 'name-asc':
      return list.sort((a, b) => stripArticle(a.albumName).localeCompare(stripArticle(b.albumName)));
    case 'name-desc':
      return list.sort((a, b) => stripArticle(b.albumName).localeCompare(stripArticle(a.albumName)));
    case 'missing':
      return list.sort((a, b) => {
        const aMissing = a.statistics.percentOfTracks < 100 && a.statistics.sizeOnDisk === 0;
        const bMissing = b.statistics.percentOfTracks < 100 && b.statistics.sizeOnDisk === 0;
        if (aMissing !== bMissing) return aMissing ? -1 : 1;
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      });
  }
}

export default function AlbumsGridScreen() {
  const { artistId, artistMbid, albumType, artistName } = useLocalSearchParams<{
    artistId: string;
    artistMbid: string;
    albumType: string;
    title: string;
    artistName: string;
  }>();
  const colors = Colors[useColorScheme()];

  const { data: rawAlbums, isLoading, refetch } = useLibraryAlbums(artistId);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  const { albums: typedAlbums } = useAlbumsWithTypes(artistMbid, rawAlbums);
  const { data: downloadStatuses } = useDownloadStatuses(rawAlbums);
  const [sortMode, setRawSortMode] = useState<AlbumSortMode>('date-desc');
  const setSortMode = useCallback((mode: AlbumSortMode) => {
    setRawSortMode(mode);
  }, []);

  const albums = useMemo(
    () =>
      sortAlbums(
        typedAlbums?.filter((a) => a.albumType === (albumType as PrimaryReleaseType)) ?? [],
        sortMode,
      ),
    [typedAlbums, albumType, sortMode],
  );

  const listRef = useRef<FlashListRef<Album>>(null);
  const sortSheetRef = useRef<BottomSheet>(null);
  const albumSheetRef = useRef<BottomSheet>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const openAlbum = useCallback((album: Album) => {
    setSelectedAlbum(album);
    albumSheetRef.current?.snapToIndex(0);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Album }) => {
      return (
        <View style={styles.gridItem}>
          <AlbumCard album={item} onPress={() => openAlbum(item)} fill downloadStatus={downloadStatuses?.[item.id]?.status} />
        </View>
      );
    },
    [openAlbum, downloadStatuses],
  );

  if (isLoading) {
    return (
      <View style={[styles.listContent, { flex: 1, justifyContent: 'center', backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="arrow.up.arrow.down" title="Sort By">
          {ALBUM_SORT_OPTIONS.map((option) => (
            <Stack.Toolbar.MenuAction
              key={option.key}
              icon={option.iosIcon as any}
              isOn={sortMode === option.key}
              onPress={() => setSortMode(option.key)}
            >
              {option.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlashList
        key={sortMode}
        ref={listRef}
        data={albums}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        ListHeaderComponent={
          IS_IOS ? undefined : (
            <View style={styles.sortRow}>
              <AlbumSortTrigger selected={sortMode} onPress={() => sortSheetRef.current?.snapToIndex(0)} />
            </View>
          )
        }
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
      />

      {!IS_IOS && (
        <AlbumSortSheet sheetRef={sortSheetRef} selected={sortMode} onChange={setSortMode} />
      )}

      <AlbumSheet
        album={selectedAlbum}
        artistName={artistName ?? ''}
        sheetRef={albumSheetRef}
        onDeleted={() => setSelectedAlbum(null)}
        downloadStatus={selectedAlbum ? downloadStatuses?.[selectedAlbum.id]?.status : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: EDGE_PADDING,
    paddingTop: EDGE_PADDING,
  },
  gridItem: {
    flex: 1,
    paddingHorizontal: CARD_GAP / 2,
    paddingBottom: CARD_GAP,
  },
  sortRow: {
    paddingBottom: 12,
  },
});
