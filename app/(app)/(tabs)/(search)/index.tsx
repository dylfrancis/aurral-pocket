import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRouter } from 'expo-router';
import { SearchArtistRow } from '@/components/search/SearchArtistRow';
import { TagArtistRow } from '@/components/search/TagArtistRow';
import { TagSuggestions } from '@/components/search/TagSuggestions';
import { SearchBar } from '@/components/library/SearchBar';
import { EmptyState } from '@/components/library/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useArtistSearch } from '@/hooks/search/use-artist-search';
import { useTagSuggestions } from '@/hooks/search/use-tag-suggestions';
import { useArtistsByTag } from '@/hooks/search/use-artists-by-tag';
import { useLibraryLookup } from '@/hooks/search/use-library-lookup';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { SearchArtist, TagArtist, TagSearchScope } from '@/lib/types/search';

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

type ScopePillsProps = {
  scope: TagSearchScope;
  onChange: (scope: TagSearchScope) => void;
};

function ScopePills({ scope, onChange }: ScopePillsProps) {
  const colors = Colors[useColorScheme()];
  const options: { key: TagSearchScope; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'recommended', label: 'Recommended' },
  ];

  return (
    <View style={styles.scopeRow}>
      {options.map((option) => {
        const active = scope === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              styles.scopePill,
              {
                backgroundColor: active ? `${colors.brand}20` : colors.card,
                borderColor: active ? colors.brand : colors.separator,
              },
            ]}
          >
            <Text
              variant="caption"
              style={[
                styles.scopeLabel,
                { color: active ? colors.brand : colors.subtle },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  const [query, setQuery] = useState('');
  const [tagScope, setTagScope] = useState<TagSearchScope>('all');

  const isTagSearch = query.trimStart().startsWith('#');
  const tagQuery = isTagSearch ? query.trimStart().slice(1).trim() : '';
  const artistQuery = isTagSearch ? '' : query;

  const { data: artistData, isLoading: artistLoading } = useArtistSearch(artistQuery);
  const { data: tags } = useTagSuggestions(artistQuery);
  const { data: tagData, isLoading: tagLoading } = useArtistsByTag(
    tagQuery.length >= 2 ? tagQuery : null,
    tagScope,
  );
  const { isInLibrary } = useLibraryLookup();

  const hasQuery = query.trim().length >= 2;
  const isLoading = isTagSearch ? tagLoading : artistLoading;

  const artists = artistData?.artists;
  const tagArtists = tagData?.recommendations;

  const showArtistResults = !isTagSearch && artists !== undefined && artists.length > 0;
  const showTagResults = isTagSearch && tagArtists !== undefined && tagArtists.length > 0;
  const showNoResults = hasQuery && !isLoading
    && (isTagSearch
      ? tagArtists !== undefined && tagArtists.length === 0
      : artists !== undefined && artists.length === 0 && (!tags || tags.length === 0));

  useEffect(() => {
    if (IS_IOS) {
      navigation.setOptions({
        headerSearchBarOptions: {
          placeholder: 'Artists, bands, #tags...',
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

  const handleArtistPress = useCallback(
    (artist: SearchArtist | TagArtist) => {
      router.push({
        pathname: '/artist/[mbid]' as any,
        params: { mbid: artist.id, name: artist.name },
      });
    },
    [router],
  );

  const handleTagSelect = useCallback((tag: string) => {
    setQuery(`#${tag}`);
    if (IS_IOS) {
      // iOS native search bar — update via setOptions
      navigation.setOptions({
        headerSearchBarOptions: {
          placeholder: 'Artists, bands, #tags...',
          hideWhenScrolling: false,
          autoCapitalize: 'none',
          text: `#${tag}`,
          onChangeText: (e: { nativeEvent: { text: string } }) => {
            setQuery(e.nativeEvent.text);
          },
          onCancelButtonPress: () => setQuery(''),
        },
      });
    }
  }, [navigation]);

  const renderArtistItem = useCallback(
    ({ item }: { item: SearchArtist }) => (
      <SearchArtistRow
        artist={item}
        isInLibrary={isInLibrary(item.id)}
        onPress={() => handleArtistPress(item)}
      />
    ),
    [isInLibrary, handleArtistPress],
  );

  const renderTagArtistItem = useCallback(
    ({ item }: { item: TagArtist }) => (
      <TagArtistRow
        artist={item}
        isInLibrary={isInLibrary(item.id)}
        onPress={() => handleArtistPress(item)}
      />
    ),
    [isInLibrary, handleArtistPress],
  );

  const listHeader = useMemo(() => (
    <>
      {!IS_IOS && (
        <View style={styles.androidSearchBar}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            sortMode="alpha"
            onSortChange={() => {}}
            showSort={false}
          />
        </View>
      )}
      {isTagSearch && hasQuery && (
        <ScopePills scope={tagScope} onChange={setTagScope} />
      )}
      {!isTagSearch && tags && tags.length > 0 && (
        <TagSuggestions tags={tags} onSelect={handleTagSelect} />
      )}
    </>
  ), [query, isTagSearch, hasQuery, tagScope, tags, handleTagSelect]);

  const emptyComponent = useMemo(() => {
    if (isLoading) return <SkeletonRows />;
    if (showNoResults) {
      return (
        <EmptyState
          icon="search-outline"
          message={`No results found for "${query.trim()}"`}
        />
      );
    }
    if (!hasQuery) {
      return (
        <EmptyState
          icon="search-outline"
          message="Search for artists or #tags to discover music"
        />
      );
    }
    return null;
  }, [isLoading, showNoResults, hasQuery, query]);

  if (isTagSearch) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlashList
          data={showTagResults ? tagArtists : []}
          renderItem={renderTagArtistItem}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyComponent}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlashList
        data={showArtistResults ? artists : []}
        renderItem={renderArtistItem}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
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
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scopePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  scopeLabel: {
    fontFamily: Fonts.medium,
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
