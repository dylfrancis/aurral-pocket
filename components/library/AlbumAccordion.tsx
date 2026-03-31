import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/Text';
import { CoverArtImage } from './CoverArtImage';
import { TrackRow } from './TrackRow';
import { useLibraryTracks } from '@/hooks/library/use-library-tracks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { Album } from '@/lib/types/library';

type AlbumAccordionProps = {
  album: Album;
};

export function AlbumAccordion({ album }: AlbumAccordionProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = Colors[useColorScheme()];
  const rotation = useSharedValue(0);

  const albumId = expanded ? album.id : undefined;
  const { data: tracks, isLoading } = useLibraryTracks(albumId);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  const year = album.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;

  function toggle() {
    setExpanded((prev) => !prev);
    rotation.value = withTiming(expanded ? 0 : 90, { duration: 200 });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Pressable onPress={toggle} style={styles.header}>
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
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Animated.View>
      </Pressable>

      {expanded && (
        <View style={[styles.trackList, { borderTopColor: colors.separator }]}>
          {isLoading ? (
            <ActivityIndicator style={styles.loader} color={colors.brand} />
          ) : (
            tracks?.map((track) => <TrackRow key={track.id} track={track} />)
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  albumName: {
    fontFamily: Fonts.medium,
  },
  trackList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  loader: {
    paddingVertical: 20,
  },
});
