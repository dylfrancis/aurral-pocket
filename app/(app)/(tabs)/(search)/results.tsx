import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
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
import Group from "@expo/material-symbols/group.xml";
import Album from "@expo/material-symbols/album.xml";
import FilterList from "@expo/material-symbols/filter_list.xml";
import { SearchArtistRow } from "@/components/search/SearchArtistRow";
import { SearchAlbumRow } from "@/components/search/SearchAlbumRow";
import { SearchAlbumCard } from "@/components/search/SearchAlbumCard";
import { TagArtistRow } from "@/components/search/TagArtistRow";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonRows } from "@/components/search/SkeletonRows";
import { Text } from "@/components/ui/Text";
import { HorizontalArtistCard } from "@/components/discover/HorizontalArtistCard";
import { viewModeMenuSection } from "@/components/ui/ViewModeMenuActions";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import { useAlbumSearch } from "@/hooks/search/use-album-search";
import { useArtistsByTag } from "@/hooks/search/use-artists-by-tag";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useGridColumns } from "@/hooks/use-grid-columns";
import { useViewMode } from "@/hooks/use-view-mode";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { releaseRouteParams } from "@/lib/library-read";
import { Colors, Fonts } from "@/constants/theme";
import type {
  SearchAlbum,
  SearchArtist,
  TagArtist,
  TagSearchScope,
} from "@/lib/types/search";

type ResultScope = "artist" | "album";

type ScopeOption<T> = {
  key: T;
  label: string;
  iosIcon: string;
  androidIcon: number;
};

const SCOPE_OPTIONS: ScopeOption<ResultScope>[] = [
  { key: "artist", label: "Artists", iosIcon: "person.2", androidIcon: Group },
  {
    key: "album",
    label: "Albums",
    iosIcon: "opticaldisc",
    androidIcon: Album,
  },
];

const EDGE_PADDING = 12;
const CARD_GAP = 12;

const TAG_SCOPE_OPTIONS: ScopeOption<TagSearchScope>[] = [
  { key: "all", label: "All Artists", iosIcon: "globe", androidIcon: Public },
  {
    key: "recommended",
    label: "Recommended",
    iosIcon: "star",
    androidIcon: Star,
  },
];

export default function SearchResultsScreen() {
  const { q, scope: scopeParam } = useLocalSearchParams<{
    q: string;
    scope?: ResultScope;
  }>();
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  const query = q ?? "";
  const isTagSearch = query.startsWith("#");
  const tagQuery = isTagSearch ? query.slice(1).trim() : "";

  const [tagScope, setTagScope] = useState<TagSearchScope>("recommended");
  const [resultScope, setResultScope] = useState<ResultScope>(
    scopeParam === "album" ? "album" : "artist",
  );
  const [viewMode, setViewMode] = useViewMode("search-results", "list");
  const gridColumns = useGridColumns(EDGE_PADDING * 2);

  const {
    data: artistData,
    isLoading: artistLoading,
    refetch: refetchArtists,
  } = useArtistSearch(
    isTagSearch || resultScope !== "artist" ? "" : query,
    // Dedicated results screen: the user is waiting on a considered answer,
    // so search harder than the typeahead does.
    "full",
  );

  const {
    data: albumData,
    isLoading: albumLoading,
    refetch: refetchAlbums,
  } = useAlbumSearch(isTagSearch || resultScope !== "album" ? "" : query);

  const {
    data: tagData,
    isLoading: tagLoading,
    refetch: refetchTags,
  } = useArtistsByTag(
    isTagSearch && tagQuery.length >= 2 ? tagQuery : null,
    tagScope,
  );

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isTagSearch) {
      await refetchTags();
    } else if (resultScope === "album") {
      await refetchAlbums();
    } else {
      await refetchArtists();
    }
    setRefreshing(false);
  }, [isTagSearch, resultScope, refetchTags, refetchAlbums, refetchArtists]);
  const { isInLibrary } = useLibraryLookup();

  const isLoading = isTagSearch
    ? tagLoading
    : resultScope === "album"
      ? albumLoading
      : artistLoading;

  const artists = artistData?.artists;
  const albums = albumData?.items;
  const tagArtists = tagData?.recommendations;

  const fullData = isTagSearch
    ? tagArtists
    : resultScope === "album"
      ? albums
      : artists;
  const resultCount = fullData?.length ?? 0;
  const showResults = fullData !== undefined && resultCount > 0;
  const showNoResults =
    !isLoading && fullData !== undefined && resultCount === 0;

  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({
      headerTitle: isTagSearch ? "Tag Results" : `Results for "${query}"`,
    });
  }, [navigation, isTagSearch, query]);

  const handleArtistPress = useCallback(
    (artist: SearchArtist | TagArtist) => {
      router.push({
        pathname: "/artist/[mbid]",
        params: { mbid: artist.id, name: artist.name },
      });
    },
    [router],
  );

  // A bare path, so expo-router resolves it inside the search group.
  const handleAlbumPress = useCallback(
    (album: SearchAlbum) => {
      router.push({
        pathname: "/release/[mbid]",
        params: releaseRouteParams({
          mbid: album.id,
          title: album.title,
          artistName: album.artistName,
          artistMbid: album.artistMbid,
          artistId: album.libraryArtistId,
          primaryType: album.primaryType,
          secondaryTypes: album.secondaryTypes,
          releaseDate: album.releaseDate,
          status: album.status,
          libraryAlbumId: album.libraryAlbumId,
        }),
      });
    },
    [router],
  );

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

  const renderAlbumItem = useCallback(
    ({ item }: { item: SearchAlbum }) => (
      <SearchAlbumRow album={item} onPress={() => handleAlbumPress(item)} />
    ),
    [handleAlbumPress],
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
    ({ item }: { item: SearchArtist | TagArtist }) => (
      <View style={styles.gridItem}>
        <HorizontalArtistCard
          mbid={item.id}
          name={item.name}
          isInLibrary={isInLibrary(item.id)}
          fill
          onPress={() => handleArtistPress(item)}
        />
      </View>
    ),
    [isInLibrary, handleArtistPress],
  );

  const renderAlbumGridItem = useCallback(
    ({ item }: { item: SearchAlbum }) => (
      <View style={styles.gridItem}>
        <SearchAlbumCard album={item} onPress={() => handleAlbumPress(item)} />
      </View>
    ),
    [handleAlbumPress],
  );

  const tagScopeLabel = tagScope === "recommended" ? "Recommended" : "All";
  const tagListHeader = (
    <View>
      <Text
        variant="caption"
        style={[styles.subtitle, { color: colors.subtle }]}
      >
        {tagScopeLabel} artists for tag {`“${tagQuery}”`}
      </Text>
    </View>
  );

  const canBroadenToAll =
    isTagSearch && tagScope === "recommended" && showNoResults;
  const skeletonVariant: "artist" | "album" =
    !isTagSearch && resultScope === "album" ? "album" : "artist";
  const emptyComponent = isLoading ? (
    <SkeletonRows count={8} variant={skeletonVariant} />
  ) : showNoResults ? (
    <EmptyState
      icon="search-outline"
      message={`No results found for “${query}”`}
      actionLabel={canBroadenToAll ? "Try searching all" : undefined}
      onAction={canBroadenToAll ? () => setTagScope("all") : undefined}
    />
  ) : null;

  const albumKeyExtractor = useMemo(() => (item: SearchAlbum) => item.id, []);
  const artistKeyExtractor = useMemo(
    () => (item: SearchArtist | TagArtist) => item.id,
    [],
  );

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={
            process.env.EXPO_OS === "ios"
              ? "line.3.horizontal.decrease"
              : FilterList
          }
          title="Scope"
        >
          {(isTagSearch ? TAG_SCOPE_OPTIONS : SCOPE_OPTIONS).map((option) => {
            const active = isTagSearch
              ? tagScope === option.key
              : resultScope === option.key;
            return (
              <Stack.Toolbar.MenuAction
                key={option.key}
                icon={
                  process.env.EXPO_OS === "ios"
                    ? (option.iosIcon as any)
                    : option.androidIcon
                }
                isOn={active}
                onPress={() => {
                  if (isTagSearch) {
                    setTagScope(option.key as TagSearchScope);
                  } else {
                    setResultScope(option.key as ResultScope);
                  }
                }}
              >
                {option.label}
              </Stack.Toolbar.MenuAction>
            );
          })}
          {viewModeMenuSection(viewMode, setViewMode)}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {isTagSearch ? (
        <FlashList
          key={`tag-${viewMode}`}
          data={showResults ? (tagArtists as TagArtist[]) : []}
          renderItem={
            viewMode === "grid" ? renderArtistGridItem : renderTagArtistItem
          }
          keyExtractor={artistKeyExtractor}
          numColumns={viewMode === "grid" ? gridColumns : 1}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={
            viewMode === "grid" ? styles.gridContent : undefined
          }
          ListHeaderComponent={tagListHeader}
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : resultScope === "album" ? (
        <FlashList
          key={`album-${viewMode}`}
          data={showResults ? (albums as SearchAlbum[]) : []}
          renderItem={
            viewMode === "grid" ? renderAlbumGridItem : renderAlbumItem
          }
          keyExtractor={albumKeyExtractor}
          numColumns={viewMode === "grid" ? gridColumns : 1}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={
            viewMode === "grid" ? styles.gridContent : undefined
          }
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : (
        <FlashList
          key={`artist-${viewMode}`}
          data={showResults ? (artists as SearchArtist[]) : []}
          renderItem={
            viewMode === "grid" ? renderArtistGridItem : renderArtistItem
          }
          keyExtractor={artistKeyExtractor}
          numColumns={viewMode === "grid" ? gridColumns : 1}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={
            viewMode === "grid" ? styles.gridContent : undefined
          }
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
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
  gridContent: {
    paddingHorizontal: EDGE_PADDING,
    paddingTop: EDGE_PADDING,
  },
  gridItem: {
    flex: 1,
    paddingHorizontal: CARD_GAP / 2,
    paddingBottom: CARD_GAP,
  },
});

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load results" />;
}
