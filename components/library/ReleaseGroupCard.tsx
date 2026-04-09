import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { CoverArtImage } from './CoverArtImage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { ReleaseGroup } from '@/lib/types/library';

const CARD_WIDTH = 150;

type ReleaseGroupCardProps = {
  releaseGroup: ReleaseGroup;
  onPress?: () => void;
};

export const ReleaseGroupCard = React.memo(function ReleaseGroupCard({
  releaseGroup,
  onPress,
}: ReleaseGroupCardProps) {
  const colors = Colors[useColorScheme()];

  const year = releaseGroup['first-release-date']
    ? new Date(releaseGroup['first-release-date']).getFullYear()
    : null;

  const type = releaseGroup['primary-type'] ?? 'Album';
  const secondary = releaseGroup['secondary-types'];
  const typeLabel = secondary && secondary.length > 0
    ? `${type} · ${secondary.join(', ')}`
    : type;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, { opacity: pressed ? 0.8 : 1 }]}
    >
      <CoverArtImage type="album" mbid={releaseGroup.id} size={CARD_WIDTH} borderRadius={10} />
      <View style={styles.meta}>
        <Text variant="body" numberOfLines={2} style={styles.title}>
          {releaseGroup.title}
        </Text>
        <Text variant="caption" numberOfLines={1} style={{ color: colors.subtle }}>
          {year && `${year} · `}{typeLabel}
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
  meta: {
    paddingTop: 6,
    gap: 2,
  },
  title: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 17,
  },
});
