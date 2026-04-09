import { StyleSheet, View } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCoverArtUrl } from '@/hooks/library/use-cover-art-url';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { CoverArtType } from '@/lib/types/library';

type CoverArtImageProps = {
  type: CoverArtType;
  mbid: string;
  size: number | 'fill';
  style?: ImageStyle;
  borderRadius?: number;
  blurRadius?: number;
};

export function CoverArtImage({
  type,
  mbid,
  size,
  style,
  borderRadius = 8,
  blurRadius,
}: CoverArtImageProps) {
  const { url, isLoading } = useCoverArtUrl({ type, mbid });
  const colors = Colors[useColorScheme()];

  const sizeStyle =
    size === 'fill'
      ? { width: '100%' as const, aspectRatio: 1 }
      : { width: size, height: size };

  if (isLoading) {
    return size === 'fill' ? (
      <Skeleton width="100%" height={0} borderRadius={borderRadius} style={{ aspectRatio: 1 }} />
    ) : (
      <Skeleton width={size} height={size} borderRadius={borderRadius} />
    );
  }

  if (!url) {
    return (
      <View
        style={[
          styles.placeholder,
          sizeStyle,
          { borderRadius, backgroundColor: colors.card },
          style,
        ]}
      >
        <Ionicons
          name="musical-notes-outline"
          size={size === 'fill' ? 48 : size * 0.35}
          color={colors.brand}
        />
      </View>
    );
  }

  return (
    <Image
      source={url ? { uri: url } : undefined}
      style={[sizeStyle, { borderRadius }, style]}
      contentFit="cover"
      transition={200}
      blurRadius={blurRadius}
      recyclingKey={`${type}-${mbid}`}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
