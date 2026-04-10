import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SearchArtistRow } from '@/components/search/SearchArtistRow';
import { TagArtistRow } from '@/components/search/TagArtistRow';
import { SearchBar } from '@/components/library/SearchBar';
import { EmptyState } from '@/components/library/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useArtistSearch } from '@/hooks/search/use-artist-search';
import { useTagSuggestions } from '@/hooks/search/use-tag-suggestions';
import { useArtistsByTag } from '@/hooks/search/use-artists-by-tag';
import { useLibraryLookup } from '@/hooks/search/use-library-lookup';
import { useRecentSearches } from '@/hooks/search/use-recent-searches';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
import type { SearchArtist, TagArtist, TagSearchScope } from '@/lib/types/search';

const IS_IOS = Platform.OS === 'ios';
const PREVIEW_LIMIT = 5;

/* ---------- Skeleton loading ---------- */

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

/* ---------- Scope pills (Android only) ---------- */

type ScopePillsProps = {
  scope: TagSearchScope;
  onChange: (scope: TagSearchScope) => void;
};

const SCOPE_OPTIONS: { key: TagSearchScope; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'recommended', label: 'Recommended' },
];

function ScopePills({ scope, onChange }: ScopePillsProps) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.scopeRow}>
      {SCOPE_OPTIONS.map((option) => {
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

/* ---------- Preview rows ---------- */

function ArtistPreviewRow({
  artist,
  isInLibrary,
  onPress,
}: {
  artist: SearchArtist | TagArtist;
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

/* ---------- Recent searches ---------- */

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

/* ---------- Main screen ---------- */

export default function SearchScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  const [query, setQuery] = useState('');
  const [committed, setCommitted] = useState(false);
  const [tagScope, setTagScope] = useState<TagSearchScope>('all');
  const skipResetRef = useRef(false);

  const isTagSearch = query.trimStart().startsWith('#');
  const tagQuery = isTagSearch ? query.trimStart().slice(1).trim() : '';
  const artistQuery = isTagSearch ? '' : query;
  const hasQuery = query.trim().length >= 2 || (isTagSearch && tagQuery.length >= 2);

  const { data: artistData, isLoading: artistLoading } = useArtistSearch(artistQuery);
  const { data: tags } = useTagSuggestions(isTagSearch ? tagQuery : artistQuery);
  const { data: tagData, isLoading: tagLoading } = useArtistsByTag(
    committed && tagQuery.length >= 2 ? tagQuery : null,
    tagScope,
  );
  const { isInLibrary } = useLibraryLookup();
  const recentSearches = useRecentSearches();

  const artists = artistData?.artists;
  const tagArtists = tagData?.recommendations;

  // Reset committed when query changes (user is typing again)
  useEffect(() => {
    if (skipResetRef.current) {
      skipResetRef.current = false;
      return;
    }
    setCommitted(false);
  }, [query]);

  const handleSubmit = useCallback(() => {
    Keyboard.dismiss();
    setCommitted(true);
    if (query.trim()) recentSearches.add(query.trim());
  }, [query, recentSearches]);

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
          onCancelButtonPress: () => { setQuery(''); setCommitted(false); },
          onSearchButtonPress: handleSubmit,
        },
      });
    }
  }, [navigation, handleSubmit]);

  const handleArtistPress = useCallback(
    (artist: SearchArtist | TagArtist) => {
      router.push({
        pathname: '/artist/[mbid]' as any,
        params: { mbid: artist.id, name: artist.name },
      });
    },
    [router],
  );

  const setQueryCommitted = useCallback((value: string) => {
    skipResetRef.current = true;
    setQuery(value);
    setCommitted(true);
    recentSearches.add(value);
    if (IS_IOS) {
      navigation.setOptions({
        headerSearchBarOptions: {
          placeholder: 'Artists, bands, #tags...',
          hideWhenScrolling: false,
          autoCapitalize: 'none',
          text: value,
          onChangeText: (e: { nativeEvent: { text: string } }) => {
            setQuery(e.nativeEvent.text);
          },
          onCancelButtonPress: () => { setQuery(''); setCommitted(false); },
          onSearchButtonPress: handleSubmit,
        },
      });
    }
  }, [navigation, handleSubmit, recentSearches]);

  const handleTagSelect = useCallback(
    (tag: string) => setQueryCommitted(`#${tag}`),
    [setQueryCommitted],
  );

  const handleRecentPress = useCallback(
    (recent: string) => setQueryCommitted(recent),
    [setQueryCommitted],
  );

  /* ---------- Derive display state ---------- */

  const isPreview = hasQuery && !committed;
  const isFullResults = hasQuery && committed;

  // Preview data
  const previewTags = isPreview ? (tags ?? []).slice(0, isTagSearch ? PREVIEW_LIMIT : 3) : [];
  const previewArtists = isPreview && !isTagSearch ? (artists ?? []).slice(0, PREVIEW_LIMIT) : [];
  const previewLoading = isPreview && !isTagSearch && artistLoading;

  // Full results data
  const fullData = isTagSearch ? tagArtists : artists;
  const fullLoading = isFullResults && (isTagSearch ? tagLoading : artistLoading);
  const showResults = isFullResults && fullData !== undefined && fullData.length > 0;
  const showNoResults = isFullResults && !fullLoading && fullData !== undefined && fullData.length === 0;

  // Show scope toolbar only for committed tag search
  const showScopeToolbar = isFullResults && isTagSearch;

  /* ---------- Render items for FlashList ---------- */

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

  /* ---------- List header ---------- */

  const listHeader = (
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

      {/* Scope pills for committed tag search */}
      {showScopeToolbar && (
        <ScopePills scope={tagScope} onChange={setTagScope} />
      )}

      {/* Preview content */}
      {isPreview && (
        previewLoading ? (
          <SkeletonRows />
        ) : (previewTags.length > 0 || previewArtists.length > 0) ? (
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
        ) : hasQuery && !previewLoading ? (
          <EmptyState
            icon="search-outline"
            message={`No results for "${query.trim()}"`}
          />
        ) : null
      )}
    </>
  );

  /* ---------- List empty (idle + full results empty) ---------- */

  const emptyComponent = fullLoading ? (
    <SkeletonRows />
  ) : showNoResults ? (
    <EmptyState
      icon="search-outline"
      message={`No results found for "${query.trim()}"`}
    />
  ) : !hasQuery ? (
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

  /* ---------- Render ---------- */

  const data = (isFullResults && isTagSearch)
    ? (showResults ? (tagArtists as TagArtist[]) : [])
    : (showResults ? (artists as SearchArtist[]) : []);

  const renderItem = (isFullResults && isTagSearch)
    ? renderTagArtistItem
    : renderArtistItem;

  return (
    <>
      <FlashList
        data={data as any[]}
        renderItem={renderItem as any}
        keyExtractor={(item: any) => item.id}
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
