import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import BottomSheet from '@gorhom/bottom-sheet';
import { useLocalSearchParams } from 'expo-router';
import { AlbumCard } from '@/components/library/AlbumCard';
import { AlbumSheet } from '@/components/library/AlbumSheet';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Album } from '@/lib/types/library';

const EDGE_PADDING = 12;
const CARD_GAP = 12;
const NUM_COLUMNS = 2;

export default function AlbumsGridScreen() {
  const { albums: serialized, artistName } = useLocalSearchParams<{
    albums: string;
    title: string;
    artistName: string;
  }>();
  const colors = Colors[useColorScheme()];

  const albums: Album[] = serialized ? JSON.parse(serialized) : [];

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
          <AlbumCard album={item} onPress={() => openAlbum(item)} fill />
        </View>
      );
    },
    [openAlbum],
  );

  return (
    <>
      <FlashList
        data={albums}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        contentInsetAdjustmentBehavior="automatic"
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
