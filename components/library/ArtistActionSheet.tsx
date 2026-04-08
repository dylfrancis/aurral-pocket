import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { PreviewTrackRow } from './PreviewTrackRow';
import { refreshLibraryArtist } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';
import { useArtistDetails } from '@/hooks/library/use-artist-details';
import { usePreviewPlayer } from '@/hooks/library/use-preview-player';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { Artist } from '@/lib/types/library';

type ArtistActionSheetProps = {
  artist: Artist;
  sheetRef: React.RefObject<BottomSheet | null>;
};

export function ArtistActionSheet({ artist, sheetRef }: ArtistActionSheetProps) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: details } = useArtistDetails(artist.mbid);
  const preview = usePreviewPlayer(artist.mbid, artist.artistName);
  const [bioExpanded, setBioExpanded] = useState(false);

  const refreshMutation = useMutation({
    mutationFn: () => refreshLibraryArtist(artist.mbid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.artist(artist.mbid) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.albums(artist.id) });
    },
  });

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        preview.stop();
        setBioExpanded(false);
      }
    },
    [preview],
  );

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
      enableDynamicSizing
      enablePanDownToClose
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <Text variant="title" style={[styles.title, { flex: 1 }]}>
              {artist.artistName}
            </Text>
            <Pressable
              onPress={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              style={({ pressed }) => [styles.resyncButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              {refreshMutation.isPending ? (
                <ActivityIndicator size={16} color={colors.brand} />
              ) : (
                <Ionicons name="sync-outline" size={18} color={colors.brand} />
              )}
              <Text variant="caption" style={{ color: colors.brand }}>
                {refreshMutation.isSuccess ? 'Refreshed' : 'Refresh'}
              </Text>
            </Pressable>
          </View>
          {details?.bio && (
            <>
              <Text
                variant="caption"
                style={styles.bio}
                numberOfLines={bioExpanded ? undefined : 4}
              >
                {details.bio}
              </Text>
              <Pressable onPress={() => setBioExpanded((prev) => !prev)}>
                <Text variant="caption" style={{ color: colors.brand }}>
                  {bioExpanded ? 'Show less' : 'Show more'}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {preview.tracks && preview.tracks.length > 0 && (
          <View style={[styles.previewSection, { borderColor: colors.separator }]}>
            <Text variant="caption" style={styles.previewHeader}>
              Top Tracks
            </Text>
            {preview.tracks.map((track) => (
              <PreviewTrackRow
                key={track.id}
                track={track}
                isPlaying={preview.playingId === track.id}
                progress={preview.playingId === track.id ? preview.progress : 0}
                onToggle={() => preview.toggle(track)}
              />
            ))}
          </View>
        )}

        <View style={[styles.actions, { borderColor: colors.separator }]}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() =>
              Linking.openURL(
                `https://www.last.fm/music/${encodeURIComponent(artist.artistName)}`,
              )
            }
          >
            <Ionicons name="open-outline" size={20} color={colors.text} />
            <Text variant="body">View on Last.fm</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() =>
              Linking.openURL(`https://musicbrainz.org/artist/${artist.mbid}`)
            }
          >
            <Ionicons name="open-outline" size={20} color={colors.text} />
            <Text variant="body">View on MusicBrainz</Text>
          </Pressable>

        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  resyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  bio: {
    lineHeight: 18,
  },
  previewSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewHeader: {
    fontFamily: Fonts.semiBold,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actions: {
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
});
