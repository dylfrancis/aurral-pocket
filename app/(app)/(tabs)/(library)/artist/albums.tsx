import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import BottomSheet from '@gorhom/bottom-sheet';
import { useLocalSearchParams } from 'expo-router';
import { AlbumCard } from '@/components/library/AlbumCard';
import { AlbumSheet } from '@/components/library/AlbumSheet';
import { useLibraryAlbums } from '@/hooks/library/use-library-albums';
import { useAlbumsWithTypes } from '@/hooks/library/use-albums-with-types';
import { useDownloadStatuses } from '@/hooks/library/use-download-statuses';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Album, PrimaryReleaseType } from '@/lib/types/library';

const EDGE_PADDING = 12;
const CARD_GAP = 12;
const NUM_COLUMNS = 2;

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

  const albums = useMemo(
    () =>
      typedAlbums?.filter((a) => a.albumType === (albumType as PrimaryReleaseType)) ?? [],
    [typedAlbums, albumType],
  );

  const albumSheetRef = useRef<BottomSheet>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const openAlbum = useCallback((album: Album) => {
    setSelectedAlbum(album);
    albumSheetRef.current?.snapToIndex(0);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Album; index: number }) => {
      const isLeft = index % NUM_COLUMNS === 0;
      return (
        <View
          style={{
            flex: 1,
            paddingLeft: isLeft ? 0 : CARD_GAP / 2,
            paddingRight: isLeft ? CARD_GAP / 2 : 0,
            paddingBottom: CARD_GAP,
          }}
        >
          <AlbumCard album={item} onPress={() => openAlbum(item)} fill downloadStatus={downloadStatuses?.[item.id]?.status} />
        </View>
      );
    },
    [openAlbum],
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
      <FlashList
        data={albums}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
      />

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
});
