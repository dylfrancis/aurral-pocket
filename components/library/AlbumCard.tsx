import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { CoverArtImage } from './CoverArtImage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { Album, DownloadStatusValue } from '@/lib/types/library';

const CARD_WIDTH = 150;

const STATUS_LABELS: Record<string, string> = {
  adding: 'Adding...',
  searching: 'Searching...',
  downloading: 'Downloading...',
  moving: 'Moving...',
  processing: 'Processing...',
  failed: 'Failed',
};

type AlbumCardProps = {
  album: Album;
  onPress: () => void;
  fill?: boolean;
  downloadStatus?: DownloadStatusValue;
};

export const AlbumCard = React.memo(function AlbumCard({ album, onPress, fill, downloadStatus }: AlbumCardProps) {
  const colors = Colors[useColorScheme()];

  const year = album.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;

  const { trackCount, percentOfTracks } = album.statistics;
  const percent = Math.round(percentOfTracks);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        fill ? styles.containerFill : styles.container,
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <CoverArtImage
        type="album"
        mbid={album.mbid}
        size={fill ? 'fill' : CARD_WIDTH}
        borderRadius={10}
      />
      <View style={styles.meta}>
        <Text variant="body" numberOfLines={2} style={styles.albumName}>
          {album.albumName}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {year && `${year} · `}
          {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
          {' · '}
          <Text
            variant="caption"
            style={{ color: percent === 100 ? colors.brandStrong : downloadStatus === 'failed' ? colors.error : colors.subtle }}
          >
            {downloadStatus && percent < 100
              ? STATUS_LABELS[downloadStatus] ?? `${percent}%`
              : `${percent}%`}
          </Text>
        </Text>

      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginRight: 12,
  },
  containerFill: {
    flex: 1,
  },
  meta: {
    paddingTop: 6,
    gap: 2,
  },
  albumName: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 17,
  },
});
