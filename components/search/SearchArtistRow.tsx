import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { SearchArtist } from '@/lib/types/search';

type SearchArtistRowProps = {
  artist: SearchArtist;
  isInLibrary: boolean;
  onPress: () => void;
};

const THUMB_SIZE = 48;

export const SearchArtistRow = React.memo(function SearchArtistRow({
  artist,
  isInLibrary,
  onPress,
}: SearchArtistRowProps) {
  const colors = Colors[useColorScheme()];
  const imageUrl = artist.image ?? artist.imageUrl;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.thumb, { backgroundColor: colors.card }]}
          contentFit="cover"
          transition={150}
          recyclingKey={`search-${artist.id}`}
        />
      ) : (
        <View style={[styles.thumb, styles.placeholder, { backgroundColor: colors.card }]}>
          <Ionicons name="person-outline" size={20} color={colors.subtle} />
        </View>
      )}

      <View style={styles.meta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.name, { color: colors.text }]}
        >
          {artist.name}
        </Text>
        {artist['sort-name'] !== artist.name && (
          <Text variant="caption" numberOfLines={1} style={{ color: colors.subtle }}>
            {artist['sort-name']}
          </Text>
        )}
      </View>

      {isInLibrary && <Chip label="In Library" variant="brand" />}

      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: Fonts.medium,
  },
});
