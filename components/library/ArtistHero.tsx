import { ActivityIndicator, Dimensions, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { CoverArtImage } from './CoverArtImage';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LibraryBadge } from './LibraryBadge';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Artist } from '@/lib/types/library';

const SCREEN_WIDTH = Dimensions.get('window').width;

type ArtistHeroProps = {
  artist: Artist;
  scrollY?: SharedValue<number>;
  refreshing?: boolean;
  onBadgePress?: () => void;
  onInfoPress?: () => void;
};

export function ArtistHero({ artist, scrollY, refreshing, onBadgePress, onInfoPress }: ArtistHeroProps) {
  const colors = Colors[useColorScheme()];

  const backgroundStyle = useAnimatedStyle(() => {
    const offset = scrollY?.value ?? 0;
    if (offset >= 0) return {};
    const scale = 1 + Math.abs(offset) / SCREEN_WIDTH;
    return {
      transform: [{ scale }, { translateY: offset / 2 }],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.background, backgroundStyle]}>
        <CoverArtImage
          type="artist"
          mbid={artist.mbid}
          size={SCREEN_WIDTH}
          borderRadius={0}
          blurRadius={25}
        />
      </Animated.View>
      {refreshing && (
        <View style={styles.refreshIndicator}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
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
        <View style={styles.badgeRow}>
          {onBadgePress && <LibraryBadge onPress={onBadgePress} />}
          {onInfoPress && (
            <Pressable
              onPress={onInfoPress}
              style={({ pressed }) => [
                styles.infoButton,
                { backgroundColor: colors.separator, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="information-circle-outline" size={28} color={colors.text} />
            </Pressable>
          )}
        </View>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  foreground: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
    gap: 8,
  },
  refreshIndicator: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
