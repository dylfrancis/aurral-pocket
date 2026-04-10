import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRouter } from 'expo-router';
import { SearchArtistRow } from '@/components/search/SearchArtistRow';
import { SearchBar } from '@/components/library/SearchBar';
import { EmptyState } from '@/components/library/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useArtistSearch } from '@/hooks/search/use-artist-search';
import { useLibraryLookup } from '@/hooks/search/use-library-lookup';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { SearchArtist } from '@/lib/types/search';

const IS_IOS = Platform.OS === 'ios';

function SkeletonRows() {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={48} height={48} borderRadius={24} />
          <View style={styles.skeletonMeta}>
            <Skeleton width={180} height={16} borderRadius={4} />
            <Skeleton width={100} height={12} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  const [query, setQuery] = useState('');
  const { data, isLoading, isFetching } = useArtistSearch(query);
  const { isInLibrary } = useLibraryLookup();

  const hasQuery = query.trim().length >= 2;
  const artists = data?.artists;
  const showLoading = hasQuery && isLoading;
  const showNoResults = hasQuery && !isLoading && artists !== undefined && artists.length === 0;
  const showResults = artists !== undefined && artists.length > 0;

  useEffect(() => {
    if (IS_IOS) {
      navigation.setOptions({
        headerSearchBarOptions: {
          placeholder: 'Artists, bands, musicians...',
          hideWhenScrolling: false,
          autoCapitalize: 'none',
          onChangeText: (e: { nativeEvent: { text: string } }) => {
            setQuery(e.nativeEvent.text);
          },
          onCancelButtonPress: () => setQuery(''),
        },
      });
    }
  }, [navigation]);

  const handlePress = useCallback(
    (artist: SearchArtist) => {
      router.push({
        pathname: '/artist/[mbid]' as any,
        params: { mbid: artist.id, name: artist.name },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: SearchArtist }) => (
      <SearchArtistRow
        artist={item}
        isInLibrary={isInLibrary(item.id)}
        onPress={() => handlePress(item)}
      />
    ),
    [isInLibrary, handlePress],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlashList
        data={showResults ? artists : []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        ListHeaderComponent={
          !IS_IOS ? (
            <View style={styles.androidSearchBar}>
              <SearchBar
                value={query}
                onChangeText={setQuery}
                sortMode="alpha"
                onSortChange={() => {}}
                showSort={false}
              />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          showLoading ? (
            <SkeletonRows />
          ) : showNoResults ? (
            <EmptyState
              icon="search-outline"
              message={`No artists found for "${query.trim()}"`}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              message="Search for artists to add to your library"
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  androidSearchBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  skeletonContainer: {
    paddingTop: 8,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  skeletonMeta: {
    gap: 6,
  },
});
