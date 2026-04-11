import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar } from '@/components/library/SearchBar';
import { EmptyState } from '@/components/library/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useArtistSearch } from '@/hooks/search/use-artist-search';
import { useTagSuggestions } from '@/hooks/search/use-tag-suggestions';
import { useLibraryLookup } from '@/hooks/search/use-library-lookup';
import { useRecentSearches } from '@/hooks/search/use-recent-searches';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { SearchArtist } from '@/lib/types/search';

const IS_IOS = Platform.OS === 'ios';
const PREVIEW_LIMIT = 5;


function SkeletonRows() {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 6 }).map((_, i) => (
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


function ArtistPreviewRow({
  artist,
  isInLibrary,
  onPress,
}: {
  artist: SearchArtist;
  isInLibrary: boolean;
  onPress: () => void;
}) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.previewRow,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name="person-outline" size={16} color={colors.subtle} />
      <Text variant="body" numberOfLines={1} style={[styles.previewText, { color: colors.text }]}>
        {artist.name}
      </Text>
      {isInLibrary && (
        <Text variant="caption" style={{ color: colors.brandStrong }}>In Library</Text>
      )}
      <Ionicons name="arrow-forward-outline" size={16} color={colors.subtle} />
    </Pressable>
  );
}

function TagPreviewRow({
  tag,
  onPress,
}: {
  tag: string;
  onPress: () => void;
}) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.previewRow,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name="pricetag-outline" size={16} color={colors.brandStrong} />
      <Text variant="body" numberOfLines={1} style={[styles.previewText, { color: colors.text }]}>
        #{tag}
      </Text>
      <Ionicons name="arrow-forward-outline" size={16} color={colors.subtle} />
    </Pressable>
  );
}


function RecentSearchRow({
  query,
  onPress,
  onRemove,
}: {
  query: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  const colors = Colors[useColorScheme()];
  const isTag = query.startsWith('#');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.previewRow,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons
        name={isTag ? 'pricetag-outline' : 'time-outline'}
        size={16}
        color={isTag ? colors.brandStrong : colors.subtle}
      />
      <Text variant="body" numberOfLines={1} style={[styles.previewText, { color: colors.text }]}>
        {query}
      </Text>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Ionicons name="close" size={16} color={colors.subtle} />
      </Pressable>
    </Pressable>
  );
}


export default function SearchScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  const [query, setQuery] = useState('');
  const recentSearches = useRecentSearches();

  const isTagSearch = query.trimStart().startsWith('#');
  const tagQuery = isTagSearch ? query.trimStart().slice(1).trim() : '';
  const artistQuery = isTagSearch ? '' : query;
  const hasQuery = query.trim().length >= 2 || (isTagSearch && tagQuery.length >= 2);

  const { data: artistData, isLoading: artistLoading } = useArtistSearch(artistQuery);
  const { data: tags } = useTagSuggestions(isTagSearch ? tagQuery : artistQuery);
  const { isInLibrary } = useLibraryLookup();

  const artists = artistData?.artists;

  const pushResults = useCallback((q: string) => {
    Keyboard.dismiss();
    recentSearches.add(q);
    router.push({
      pathname: '/results' as any,
      params: { q },
    });
  }, [router, recentSearches]);

  const handleSubmit = useCallback(() => {
    if (query.trim()) pushResults(query.trim());
  }, [query, pushResults]);

  const handleTagSelect = useCallback(
    (tag: string) => pushResults(`#${tag}`),
    [pushResults],
  );

  const handleArtistPress = useCallback(
    (artist: SearchArtist) => {
      router.push({
        pathname: '/artist/[mbid]' as any,
        params: { mbid: artist.id, name: artist.name },
      });
    },
    [router],
  );

  const handleRecentPress = useCallback(
    (recent: string) => pushResults(recent),
    [pushResults],
  );

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
          onSearchButtonPress: handleSubmit,
        },
      });
    }
  }, [navigation, handleSubmit]);

  const previewTags = hasQuery ? (tags ?? []).slice(0, isTagSearch ? PREVIEW_LIMIT : 3) : [];
  const previewArtists = hasQuery && !isTagSearch ? (artists ?? []).slice(0, PREVIEW_LIMIT) : [];
  const previewLoading = hasQuery && !isTagSearch && artistLoading;
  const hasPreviewContent = previewTags.length > 0 || previewArtists.length > 0;

  const listHeader = hasQuery ? (
    <>
      {!IS_IOS && (
        <View style={styles.androidSearchBar}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            sortMode="alpha"
            onSortChange={() => {}}
            showSort={false}
            onSubmit={handleSubmit}
          />
        </View>
      )}

      {previewLoading ? (
        <SkeletonRows />
      ) : hasPreviewContent ? (
        <View style={styles.previewSection}>
          {previewTags.map((tag) => (
            <TagPreviewRow
              key={`tag-${tag}`}
              tag={tag}
              onPress={() => handleTagSelect(tag)}
            />
          ))}
          {previewArtists.map((artist) => (
            <ArtistPreviewRow
              key={artist.id}
              artist={artist}
              isInLibrary={isInLibrary(artist.id)}
              onPress={() => handleArtistPress(artist)}
            />
          ))}
          {((isTagSearch ? tags : artists) ?? []).length > PREVIEW_LIMIT && (
            <Pressable
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.seeAllRow,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text variant="body" style={[styles.seeAllText, { color: colors.brand }]}>
                See all results
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.brand} />
            </Pressable>
          )}
        </View>
      ) : !previewLoading ? (
        <EmptyState
          icon="search-outline"
          message={`No results for "${query.trim()}"`}
        />
      ) : null}
    </>
  ) : !IS_IOS ? (
    <View style={styles.androidSearchBar}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        sortMode="alpha"
        onSortChange={() => {}}
        showSort={false}
      />
    </View>
  ) : null;

  const emptyComponent = !hasQuery ? (
    recentSearches.searches.length > 0 ? (
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text variant="caption" style={[styles.recentTitle, { color: colors.subtle }]}>
            Recent Searches
          </Text>
          <Pressable onPress={recentSearches.clear} hitSlop={8}>
            <Text variant="caption" style={{ color: colors.brand }}>Clear</Text>
          </Pressable>
        </View>
        {recentSearches.searches.map((recent) => (
          <RecentSearchRow
            key={recent}
            query={recent}
            onPress={() => handleRecentPress(recent)}
            onRemove={() => recentSearches.remove(recent)}
          />
        ))}
      </View>
    ) : (
      <EmptyState
        icon="search-outline"
        message="Search for artists or #tags to discover music"
      />
    )
  ) : null;

  return (
    <>
      <FlashList
        data={[]}
        renderItem={() => null}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
      />
    </>
  );
}

const styles = StyleSheet.create({
  androidSearchBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  previewSection: {
    paddingTop: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  previewText: {
    flex: 1,
    fontFamily: Fonts.medium,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  seeAllText: {
    fontFamily: Fonts.semiBold,
  },
  recentSection: {
    paddingTop: 8,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  recentTitle: {
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 13,
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
