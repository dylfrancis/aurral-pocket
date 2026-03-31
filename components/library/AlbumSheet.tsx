import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { CoverArtImage } from './CoverArtImage';
import { MonitoredBadge } from './MonitoredBadge';
import { TrackRow } from './TrackRow';
import { useLibraryTracks } from '@/hooks/library/use-library-tracks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { Album } from '@/lib/types/library';

type AlbumSheetProps = {
  album: Album | null;
  sheetRef: React.RefObject<BottomSheet | null>;
};

export function AlbumSheet({ album, sheetRef }: AlbumSheetProps) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const { data: tracks, isLoading } = useLibraryTracks(album?.id);

  const year = album?.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['60%', '90%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        {album && (
          <>
            <View style={styles.header}>
              <CoverArtImage type="album" mbid={album.mbid} size={120} borderRadius={10} />
              <View style={styles.headerMeta}>
                <Text variant="title" style={styles.albumName}>
                  {album.albumName}
                </Text>
                <Text variant="caption">
                  {[year, `${album.statistics.trackCount} tracks`].filter(Boolean).join(' \u00B7 ')}
                </Text>
                <MonitoredBadge monitored={album.monitored} />
              </View>
            </View>

            <View style={[styles.trackSection, { borderTopColor: colors.separator }]}>
              {isLoading ? (
                <ActivityIndicator style={styles.loader} color={colors.brand} />
              ) : tracks && tracks.length > 0 ? (
                tracks.map((track) => <TrackRow key={track.id} track={track} />)
              ) : (
                <Text variant="caption" style={styles.emptyText}>
                  No tracks available
                </Text>
              )}
            </View>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  headerMeta: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  albumName: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: Fonts.bold,
  },
  trackSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  loader: {
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
  },
});
