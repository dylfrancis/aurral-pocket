import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
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
import { IS_ANDROID, IS_IOS } from "@/constants/platform";
import type {
  SearchAlbum,
  SearchArtist,
  TagArtist,
  TagSearchScope,
} from "@/lib/types/search";

type ResultScope = "artist" | "album";

const SCOPE_OPTIONS: { key: ResultScope; label: string; icon: string }[] = [
  { key: "artist", label: "Artists", icon: "person.2" },
  { key: "album", label: "Albums", icon: "opticaldisc" },
];

const TAG_SCOPE_OPTIONS: {
  key: TagSearchScope;
  label: string;
  icon: string;
}[] = [
  { key: "all", label: "All Artists", icon: "globe" },
  { key: "recommended", label: "Recommended", icon: "star" },
];

function ScopePills<T extends string>({
  options,
  scope,
  onChange,
}: {
  options: { key: T; label: string }[];
  scope: T;
  onChange: (s: T) => void;
}) {
  const colors = Colors[useColorScheme()];

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
      {IS_ANDROID && (
        <ScopePills
          options={TAG_SCOPE_OPTIONS}
          scope={tagScope}
          onChange={setTagScope}
        />
      )}
    </View>
  );

  const resultsListHeader = IS_ANDROID ? (
    <ScopePills
      options={SCOPE_OPTIONS}
      scope={resultScope}
      onChange={setResultScope}
    />
  ) : null;

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
      {IS_IOS && isTagSearch && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            icon="line.3.horizontal.decrease.circle"
            title="Scope"
          >
            {TAG_SCOPE_OPTIONS.map((option) => (
              <Stack.Toolbar.MenuAction
                key={option.key}
                icon={option.icon as any}
                isOn={tagScope === option.key}
                onPress={() => setTagScope(option.key)}
              >
                {option.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}

      {IS_IOS && !isTagSearch && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            icon="line.3.horizontal.decrease.circle"
            title="Scope"
          >
            {SCOPE_OPTIONS.map((option) => (
              <Stack.Toolbar.MenuAction
                key={option.key}
                icon={option.icon as any}
                isOn={resultScope === option.key}
                onPress={() => setResultScope(option.key)}
              >
                {option.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}

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
          ListHeaderComponent={resultsListHeader}
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
          ListHeaderComponent={resultsListHeader}
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
  scopeRow: {
    flexDirection: "row",
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
  subtitle: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontFamily: Fonts.medium,
  },
});
