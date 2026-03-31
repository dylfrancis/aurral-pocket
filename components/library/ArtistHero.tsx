import { Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { CoverArtImage } from './CoverArtImage';
import { MonitoredBadge } from './MonitoredBadge';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Artist } from '@/lib/types/library';

const SCREEN_WIDTH = Dimensions.get('window').width;

type ArtistHeroProps = {
  artist: Artist;
};

export function ArtistHero({ artist }: ArtistHeroProps) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.container}>
      <CoverArtImage
        type="artist"
        mbid={artist.mbid}
        size={SCREEN_WIDTH}
        borderRadius={0}
        blurRadius={25}
        style={styles.background}
      />
      <LinearGradient
        colors={['transparent', colors.background]}
        style={styles.gradient}
      />
      <View style={styles.foreground}>
        <CoverArtImage
          type="artist"
          mbid={artist.mbid}
          size={200}
          borderRadius={100}
        />
        <Text variant="title" style={styles.name}>
          {artist.artistName}
        </Text>
        <MonitoredBadge monitored={artist.monitored} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    aspectRatio: 1,
    position: 'relative',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  foreground: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
    gap: 8,
  },
  name: {
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
