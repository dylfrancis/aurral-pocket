import React, { useCallback } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { CoverArtImage } from './CoverArtImage';
import { AlbumStatusBadge } from './AlbumStatusBadge';
import { TrackRow } from './TrackRow';
import { useLibraryTracks } from '@/hooks/library/use-library-tracks';
import { triggerAlbumSearch, deleteAlbum } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import type { Album, DownloadStatusValue } from '@/lib/types/library';

type AlbumSheetProps = {
  album: Album | null;
  artistName?: string;
  sheetRef: React.RefObject<BottomSheet | null>;
  onDeleted?: () => void;
  downloadStatus?: DownloadStatusValue;
};

export function AlbumSheet({ album, artistName, sheetRef, onDeleted, downloadStatus }: AlbumSheetProps) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: tracks, isLoading } = useLibraryTracks(album?.id);

  const year = album?.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;

  const isComplete = album
    ? album.statistics.percentOfTracks >= 100 || album.statistics.sizeOnDisk > 0
    : false;

  const searchMutation = useMutation({
    mutationFn: () => triggerAlbumSearch(album!.id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAlbum(album!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.albums(album!.artistId) });
      sheetRef.current?.close();
      onDeleted?.();
    },
  });

  const handleResearch = () => {
    searchMutation.mutate();
  };

  const handleLastFm = () => {
    if (!artistName || !album) return;
    const url = `https://www.last.fm/music/${encodeURIComponent(artistName)}/${encodeURIComponent(album.albumName)}`;
    Linking.openURL(url);
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Album',
      `Remove "${album?.albumName}" from your library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

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
                <AlbumStatusBadge album={album} downloadStatus={downloadStatus} />
              </View>
            </View>

            <View style={[styles.actions, { borderColor: colors.separator }]}>
              {!isComplete && !downloadStatus && (
                <Pressable
                  style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.6 : 1 }]}
                  onPress={handleResearch}
                  disabled={searchMutation.isPending}
                >
                  {searchMutation.isPending ? (
                    <ActivityIndicator size={18} color={colors.brand} />
                  ) : (
                    <Ionicons name="refresh" size={18} color={colors.brand} />
                  )}
                  <Text variant="body" style={{ color: colors.brand }}>
                    {searchMutation.isSuccess ? 'Search Triggered' : 'Re-search'}
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.6 : 1 }]}
                onPress={handleLastFm}
              >
                <Ionicons name="open-outline" size={18} color={colors.text} />
                <Text variant="body">View on Last.fm</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.6 : 1 }]}
                onPress={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size={18} color={colors.error} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                )}
                <Text variant="body" style={{ color: colors.error }}>Delete Album</Text>
              </Pressable>
            </View>

            <View style={[styles.trackSection, { borderTopColor: colors.separator }]}>
              <Text variant="subtitle" style={[styles.trackHeader, { color: colors.text }]}>
                Tracks
              </Text>
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
  actions: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  trackSection: {
    borderTopWidth: 0,
  },
  trackHeader: {
    fontFamily: Fonts.semiBold,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  loader: {
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
  },
});
