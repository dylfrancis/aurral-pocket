import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
  type ErrorBoundaryProps,
} from "expo-router";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import Public from "@expo/material-symbols/public.xml";
import Star from "@expo/material-symbols/star.xml";
import {
  SEARCH_FILTERS,
  SearchResults,
  type SearchFilter,
} from "@/components/search/SearchResults";
import { TagArtistRow } from "@/components/search/TagArtistRow";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonRows } from "@/components/search/SkeletonRows";
import { Text } from "@/components/ui/Text";
import { HorizontalArtistCard } from "@/components/discover/HorizontalArtistCard";
import { GridCell, gridListStyles } from "@/components/ui/GridCell";
import {
  FILTER_MENU_ICON,
  menuOptionActions,
  type MenuOption,
} from "@/components/ui/MenuOptions";
import { useArtistsByTag } from "@/hooks/search/use-artists-by-tag";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useSearchResults } from "@/hooks/search/use-search-results";
import { useGridListView } from "@/hooks/use-grid-list-view";
import { Fonts } from "@/constants/theme";
import type { TagArtist, TagSearchScope } from "@/lib/types/search";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { useColors } from "@/hooks/use-colors";

const TAG_SCOPE_OPTIONS: MenuOption<TagSearchScope>[] = [
  { key: "all", label: "All Artists", iosIcon: "globe", androidIcon: Public },
  {
    key: "recommended",
    label: "Recommended",
    iosIcon: "star",
    androidIcon: Star,
  },
];

/**
 * A #tag's artists, or the full results for a search started outside the
 * Search tab, such as Shazam's search by hand on Discover.
 */
export default function SearchResultsScreen() {
  const { q, filter } = useLocalSearchParams<{
    q: string;
    filter?: SearchFilter;
  }>();
  const query = q ?? "";
  const navigation = useNavigation();
  const isTagSearch = query.startsWith("#");

  useEffect(() => {
    navigation.setOptions({
      headerTitle: isTagSearch ? "Tag Results" : `Results for "${query}"`,
    });
  }, [navigation, isTagSearch, query]);

  return isTagSearch ? (
    <TagResults tag={query.slice(1).trim()} />
  ) : (
    <TextResults
      query={query}
      initialFilter={filter && SEARCH_FILTERS.includes(filter) ? filter : "all"}
    />
  );
}

function TextResults({
  query,
  initialFilter,
}: {
  query: string;
  initialFilter: SearchFilter;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState(initialFilter);
  const results = useSearchResults(query);
  const { refreshing, onRefresh } = usePullToRefresh(results.refetch);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <SearchResults
        query={query}
        results={results}
        view="full"
        filter={filter}
        onFilterChange={setFilter}
        onTagPress={(tag) =>
          router.push({ pathname: "/results", params: { q: `#${tag}` } })
        }
      />
    </ScrollView>
  );
}

function TagResults({ tag }: { tag: string }) {
  const openArtist = useOpenArtist();
  const colors = useColors();
  const [tagScope, setTagScope] = useState<TagSearchScope>("recommended");
  const { isGrid, numColumns, viewMenuSection } = useGridListView(
    "search-results",
    "list",
  );

  const {
    data: tagData,
    isLoading,
    refetch,
  } = useArtistsByTag(tag.length >= 2 ? tag : null, tagScope);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  const tagArtists = tagData?.recommendations;
  const { isInLibrary } = useLibraryLookup(
    tagArtists?.map((artist) => artist.id) ?? [],
  );
  const resultCount = tagArtists?.length ?? 0;
  const showNoResults =
    !isLoading && tagArtists !== undefined && resultCount === 0;

  const handleArtistPress = useCallback(
    (artist: TagArtist) => openArtist({ mbid: artist.id, name: artist.name }),
    [openArtist],
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

  const renderArtistGridItem = useCallback(
    ({ item }: { item: TagArtist }) => (
      <GridCell>
        <HorizontalArtistCard
          mbid={item.id}
          name={item.name}
          isInLibrary={isInLibrary(item.id)}
          fill
          onPress={() => handleArtistPress(item)}
        />
      </GridCell>
    ),
    [isInLibrary, handleArtistPress],
  );

  const tagScopeLabel = tagScope === "recommended" ? "Recommended" : "All";
  const tagListHeader = (
    <View>
      <Text
        variant="caption"
        style={[styles.subtitle, { color: colors.subtle }]}
      >
        {tagScopeLabel} artists for tag {`“${tag}”`}
      </Text>
    </View>
  );

  const canBroadenToAll = tagScope === "recommended" && showNoResults;
  const emptyComponent = isLoading ? (
    <SkeletonRows count={8} variant="artist" />
  ) : showNoResults ? (
    <EmptyState
      icon="search-outline"
      message={`No results found for “#${tag}”`}
      actionLabel={canBroadenToAll ? "Try searching all" : undefined}
      onAction={canBroadenToAll ? () => setTagScope("all") : undefined}
    />
  ) : null;

  const artistKeyExtractor = useMemo(() => (item: TagArtist) => item.id, []);

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon={FILTER_MENU_ICON} title="Scope">
          {menuOptionActions(TAG_SCOPE_OPTIONS, tagScope, setTagScope)}
          {viewMenuSection}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlashList
        key={`tag-${isGrid}`}
        data={resultCount > 0 ? (tagArtists as TagArtist[]) : []}
        renderItem={isGrid ? renderArtistGridItem : renderTagArtistItem}
        keyExtractor={artistKeyExtractor}
        numColumns={numColumns}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={isGrid ? gridListStyles.grid : undefined}
        ListHeaderComponent={tagListHeader}
        ListEmptyComponent={emptyComponent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    ...Fonts.medium,
  },
});

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load results" />;
}
