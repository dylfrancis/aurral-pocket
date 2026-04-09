import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, type NativeSyntheticEvent, Pressable, StyleSheet, type TextLayoutEventData, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { refreshLibraryArtist } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';
import { useArtistDetails } from '@/hooks/library/use-artist-details';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { Artist } from '@/lib/types/library';

type ArtistInfoSectionProps = {
  artist: Artist;
};

export function ArtistInfoSection({ artist }: ArtistInfoSectionProps) {
  const colors = Colors[useColorScheme()];
  const queryClient = useQueryClient();
  const { data: details } = useArtistDetails(artist.mbid);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioTruncated, setBioTruncated] = useState(false);

  const onBioTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      setBioTruncated(e.nativeEvent.lines.length >= 4);
    },
    [],
  );

  const refreshMutation = useMutation({
    mutationFn: () => refreshLibraryArtist(artist.mbid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.artist(artist.mbid) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.albums(artist.id) });
    },
  });

  return (
    <View style={styles.container}>
      {details?.bio && (
        <View style={styles.bioSection}>
          <Text variant="caption" style={[styles.sectionLabel, { color: colors.subtle }]}>
            About
          </Text>
          <Text
            variant="caption"
            style={styles.bio}
            numberOfLines={bioExpanded ? undefined : 4}
            onTextLayout={onBioTextLayout}
          >
            {details.bio}
          </Text>
          {(bioTruncated || bioExpanded) && (
            <Pressable onPress={() => setBioExpanded((prev) => !prev)}>
              <Text variant="caption" style={{ color: colors.brand }}>
                {bioExpanded ? 'Show less' : 'Show more'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {refreshMutation.isPending ? (
            <ActivityIndicator size={16} color={colors.brand} />
          ) : (
            <Ionicons name="sync-outline" size={18} color={colors.brand} />
          )}
          <Text variant="caption" style={{ color: colors.text }}>
            {refreshMutation.isSuccess ? 'Refreshed' : 'Refresh'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() =>
            Linking.openURL(
              `https://www.last.fm/music/${encodeURIComponent(artist.artistName)}`,
            )
          }
        >
          <Ionicons name="open-outline" size={18} color={colors.brand} />
          <Text variant="caption" style={{ color: colors.text }}>Last.fm</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() =>
            Linking.openURL(`https://musicbrainz.org/artist/${artist.mbid}`)
          }
        >
          <Ionicons name="open-outline" size={18} color={colors.brand} />
          <Text variant="caption" style={{ color: colors.text }}>MusicBrainz</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  bioSection: {
    gap: 6,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bio: {
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
});
