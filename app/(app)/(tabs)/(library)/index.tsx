import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { ArtistCard } from '@/components/library/ArtistCard';
import { SearchBar, type SortMode } from '@/components/library/SearchBar';
import { EmptyState } from '@/components/library/EmptyState';
import { useLibraryArtists } from '@/hooks/library/use-library-artists';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Artist } from '@/lib/types/library';

const EDGE_PADDING = 12;
const CARD_GAP = 16;
const NUM_COLUMNS = 2;
const IS_IOS = Platform.OS === 'ios';

const SORT_OPTIONS: { key: SortMode; label: string; icon: string }[] = [
  { key: 'alpha', label: 'Alphabetical', icon: 'textformat.abc' },
  { key: 'recent', label: 'Recently Added', icon: 'clock' },
  { key: 'albums', label: 'Album Count', icon: 'square.stack' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const colors = Colors[useColorScheme()];
  const { data: artists, isLoading, error, refetch, isRefetching } = useLibraryArtists();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('alpha');

  useEffect(() => {
    if (IS_IOS) {
      navigation.setOptions({
        headerSearchBarOptions: {
          placeholder: 'Search artists...',
          hideWhenScrolling: false,
          autoCapitalize: 'none',
          onChangeText: (e: { nativeEvent: { text: string } }) => {
            setSearchQuery(e.nativeEvent.text);
          },
        },
      });
    }
  }, [navigation]);

  const filtered = useMemo(() => {
    if (!artists) return [];
    if (!searchQuery) return artists;
    const query = searchQuery.toLowerCase();
    return artists.filter((a) => a.artistName.toLowerCase().includes(query));
  }, [artists, searchQuery]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortMode) {
      case 'alpha':
        return list.sort((a, b) => a.artistName.localeCompare(b.artistName));
      case 'recent':
        return list.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      case 'albums':
        return list.sort((a, b) => b.statistics.albumCount - a.statistics.albumCount);
    }
  }, [filtered, sortMode]);

  const renderItem = useCallback(
    ({ item, index }: { item: Artist; index: number }) => {
      const isLeft = index % NUM_COLUMNS === 0;
      return (
        <View
          style={{
            flex: 1,
            paddingLeft: isLeft ? 0 : CARD_GAP / 2,
            paddingRight: isLeft ? CARD_GAP / 2 : 0,
            paddingBottom: CARD_GAP,
          }}
        >
          <ArtistCard
            artist={item}
            onPress={() => router.push(`/artist/${item.mbid}`)}
          />
        </View>
      );
    },
    [router],
  );

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="cloud-offline-outline"
          message="Failed to load library"
          actionLabel="Try Again"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  return (
    <>
      {IS_IOS && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="arrow.up.arrow.down" title="Sort By">
            {SORT_OPTIONS.map((option) => (
              <Stack.Toolbar.MenuAction
                key={option.key}
                icon={option.icon as any}
                isOn={sortMode === option.key}
                onPress={() => setSortMode(option.key)}
              >
                {option.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}
      <FlashList
        data={sorted}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        ListHeaderComponent={
          IS_IOS ? undefined : (
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              sortMode={sortMode}
              onSortChange={setSortMode}
            />
          )
        }
        ListEmptyComponent={
          <EmptyState message="Your library is empty" />
        }
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.brand}
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: EDGE_PADDING,
    paddingTop: EDGE_PADDING,
  },
});
