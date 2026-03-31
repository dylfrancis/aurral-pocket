import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { CoverArtImage } from './CoverArtImage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { Album } from '@/lib/types/library';

type AlbumRowProps = {
  album: Album;
  onPress: () => void;
};

export const AlbumRow = React.memo(function AlbumRow({ album, onPress }: AlbumRowProps) {
  const colors = Colors[useColorScheme()];

  const year = album.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <CoverArtImage type="album" mbid={album.mbid} size={56} borderRadius={6} />
      <View style={styles.meta}>
        <Text variant="body" numberOfLines={1} style={styles.albumName}>
          {album.albumName}
        </Text>
        <Text variant="caption">
          {year && `${year} \u00B7 `}
          {album.statistics.trackCount} {album.statistics.trackCount === 1 ? 'track' : 'tracks'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  albumName: {
    fontFamily: Fonts.medium,
  },
});
