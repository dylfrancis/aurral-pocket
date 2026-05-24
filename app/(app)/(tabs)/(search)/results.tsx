import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import Public from "@expo/material-symbols/public.xml";
import Star from "@expo/material-symbols/star.xml";
import Group from "@expo/material-symbols/group.xml";
import Album from "@expo/material-symbols/album.xml";
import FilterList from "@expo/material-symbols/filter_list.xml";
import { SearchArtistRow } from "@/components/search/SearchArtistRow";
import { SearchAlbumRow } from "@/components/search/SearchAlbumRow";
import { SearchAlbumSheet } from "@/components/search/SearchAlbumSheet";
import { TagArtistRow } from "@/components/search/TagArtistRow";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonRows } from "@/components/search/SkeletonRows";
import { Text } from "@/components/ui/Text";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import { useAlbumSearch } from "@/hooks/search/use-album-search";
import { useArtistsByTag } from "@/hooks/search/use-artists-by-tag";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useColorScheme } from "@/hooks/use-color-scheme";
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

  const {
    data: artistData,
    isLoading: artistLoading,
    refetch: refetchArtists,
  } = useArtistSearch(isTagSearch || resultScope !== "artist" ? "" : query);

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

  const sheetRef = useRef<BottomSheetModal | null>(null);
  const [activeAlbum, setActiveAlbum] = useState<SearchAlbum | null>(null);
  const handleAlbumPress = useCallback((album: SearchAlbum) => {
    setActiveAlbum(album);
    sheetRef.current?.present();
  }, []);

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
              ? "line.3.horizontal.decrease.circle"
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
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {isTagSearch ? (
        <FlashList
          data={showResults ? (tagArtists as TagArtist[]) : []}
          renderItem={renderTagArtistItem}
          keyExtractor={artistKeyExtractor}
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={tagListHeader}
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : resultScope === "album" ? (
        <FlashList
          data={showResults ? (albums as SearchAlbum[]) : []}
          renderItem={renderAlbumItem}
          keyExtractor={albumKeyExtractor}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : (
        <FlashList
          data={showResults ? (artists as SearchArtist[]) : []}
          renderItem={renderArtistItem}
          keyExtractor={artistKeyExtractor}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      <SearchAlbumSheet album={activeAlbum} sheetRef={sheetRef} />
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontFamily: Fonts.medium,
  },
});
