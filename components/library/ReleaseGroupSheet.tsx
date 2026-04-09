import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { CoverArtImage } from './CoverArtImage';
import { getReleaseGroupTracks, addLibraryAlbum, searchDeezerAlbum, type ReleaseGroupTrack } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { ReleaseGroup } from '@/lib/types/library';

type ReleaseGroupSheetProps = {
  releaseGroup: ReleaseGroup | null;
  artistId: string;
  artistName: string;
  sheetRef: React.RefObject<BottomSheet | null>;
};

function formatDuration(ms: number | null) {
  if (!ms) return null;
  const totalSeconds = Math.round(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ReleaseGroupSheet({ releaseGroup, artistId, artistName, sheetRef }: ReleaseGroupSheetProps) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: tracks, isLoading } = useQuery({
    queryKey: libraryKeys.releaseGroupTracks(releaseGroup?.id ?? ''),
    queryFn: async () => {
      const deezerId = await searchDeezerAlbum(artistName, releaseGroup!.title);
      return getReleaseGroupTracks(releaseGroup!.id, deezerId ?? undefined);
    },
    enabled: !!releaseGroup,
    staleTime: 10 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addLibraryAlbum(artistId, releaseGroup!.id, releaseGroup!.title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.albums(artistId) });
      sheetRef.current?.close();
    },
  });

  // Preview player
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioModeSet, setAudioModeSet] = useState(false);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;

  useEffect(() => {
    if (status.didJustFinish) {
      setPlayingId(null);
    }
  }, [status.didJustFinish]);

  // Stop audio when switching to a different release group
  useEffect(() => {
    player.pause();
    setPlayingId(null);
  }, [releaseGroup?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopPreview = useCallback(() => {
    player.pause();
    setPlayingId(null);
  }, [player]);

  const togglePreview = useCallback(
    async (track: ReleaseGroupTrack) => {
      const trackId = track.id ?? track.mbid ?? `${track.number}`;
      if (!track.preview_url) return;

      if (!audioModeSet) {
        await setAudioModeAsync({ playsInSilentMode: true });
        setAudioModeSet(true);
      }

      if (playingId === trackId) {
        player.pause();
        setPlayingId(null);
        return;
      }

      player.replace({ uri: track.preview_url });
      player.play();
      setPlayingId(trackId);
    },
    [playingId, player, audioModeSet],
  );

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        stopPreview();
      }
    },
    [stopPreview],
  );

  const year = releaseGroup?.['first-release-date']
    ? new Date(releaseGroup['first-release-date']).getFullYear()
    : null;

  const type = releaseGroup?.['primary-type'] ?? 'Album';
  const secondary = releaseGroup?.['secondary-types'];
  const typeLabel = secondary && secondary.length > 0
    ? `${type} · ${secondary.join(', ')}`
    : type;

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
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        {releaseGroup && (
          <>
            <View style={styles.header}>
              <CoverArtImage type="album" mbid={releaseGroup.id} size={120} borderRadius={10} />
              <View style={styles.headerMeta}>
                <Text variant="title" style={styles.albumName}>
                  {releaseGroup.title}
                </Text>
                <Text variant="caption">
                  {[year, typeLabel, tracks ? `${tracks.length} tracks` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>

            <View style={[styles.actions, { borderColor: colors.separator }]}>
              <Pressable
                style={({ pressed }) => [styles.addButton, { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 }]}
                onPress={() => addMutation.mutate()}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <ActivityIndicator size={18} color="#fff" />
                ) : addMutation.isSuccess ? (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                ) : (
                  <Ionicons name="add" size={18} color="#fff" />
                )}
                <Text variant="body" style={styles.addButtonText}>
                  {addMutation.isSuccess ? 'Added' : 'Add to Library'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.trackSection}>
              <Text variant="subtitle" style={[styles.trackHeader, { color: colors.text }]}>
                Tracks
              </Text>
              {isLoading ? (
                <ActivityIndicator style={styles.loader} color={colors.brand} />
              ) : tracks && tracks.length > 0 ? (
                tracks.map((track, i) => {
                  const trackId = track.id ?? track.mbid ?? `${track.number}`;
                  const isPlaying = playingId === trackId;
                  return (
                    <ReleaseGroupTrackRow
                      key={`${track.number}-${i}`}
                      track={track}
                      hasPreview={!!track.preview_url}
                      isPlaying={isPlaying}
                      progress={isPlaying ? progress : 0}
                      onToggle={() => togglePreview(track)}
                    />
                  );
                })
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

const ReleaseGroupTrackRow = React.memo(function ReleaseGroupTrackRow({
  track,
  hasPreview,
  isPlaying,
  progress,
  onToggle,
}: {
  track: ReleaseGroupTrack;
  hasPreview: boolean;
  isPlaying: boolean;
  progress: number;
  onToggle: () => void;
}) {
  const colors = Colors[useColorScheme()];
  const duration = formatDuration(track.length);
  const trackNum = track.trackNumber ?? track.position ?? track.number;

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      <Text variant="caption" style={[styles.number, { color: colors.subtle }]}>
        {trackNum}
      </Text>
      {hasPreview && (
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: isPlaying ? colors.brand : colors.separator, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={12}
            color={isPlaying ? '#fff' : colors.text}
            style={isPlaying ? undefined : styles.playIcon}
          />
        </Pressable>
      )}
      <View style={styles.trackMeta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.title, isPlaying && { color: colors.brandStrong }]}
        >
          {track.title}
        </Text>
        {isPlaying && (
          <View style={[styles.progressBar, { backgroundColor: colors.separator }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%`, backgroundColor: colors.brand },
              ]}
            />
          </View>
        )}
      </View>
      {duration && (
        <Text variant="caption" style={{ color: colors.subtle }}>
          {duration}
        </Text>
      )}
    </View>
  );
});

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
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#fff',
    fontFamily: Fonts.semiBold,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  playButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    marginLeft: 1,
  },
  number: {
    width: 26,
    textAlign: 'center',
    fontFamily: Fonts.medium,
  },
  trackMeta: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: Fonts.medium,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    marginTop: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  loader: {
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
  },
});
