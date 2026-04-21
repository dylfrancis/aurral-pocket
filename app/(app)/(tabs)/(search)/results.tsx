import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { SearchArtistRow } from "@/components/search/SearchArtistRow";
import { TagArtistRow } from "@/components/search/TagArtistRow";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonRows } from "@/components/search/SkeletonRows";
import { Text } from "@/components/ui/Text";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import { useArtistsByTag } from "@/hooks/search/use-artists-by-tag";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { IS_ANDROID, IS_IOS } from "@/constants/platform";
import type {
  SearchArtist,
  TagArtist,
  TagSearchScope,
} from "@/lib/types/search";

const SCOPE_OPTIONS: { key: TagSearchScope; label: string; icon: string }[] = [
  { key: "all", label: "All Artists", icon: "globe" },
  { key: "recommended", label: "Recommended", icon: "star" },
];

function ScopePills({
  scope,
  onChange,
}: {
  scope: TagSearchScope;
  onChange: (s: TagSearchScope) => void;
}) {
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

export default function SearchResultsScreen() {
  const { q } = useLocalSearchParams<{ q: string }>();
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  const query = q ?? "";
  const isTagSearch = query.startsWith("#");
  const tagQuery = isTagSearch ? query.slice(1).trim() : "";

  const [tagScope, setTagScope] = useState<TagSearchScope>("recommended");

  const {
    data: artistData,
    isLoading: artistLoading,
    refetch: refetchArtists,
  } = useArtistSearch(isTagSearch ? "" : query);
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
    } else {
      await refetchArtists();
    }
    setRefreshing(false);
  }, [isTagSearch, refetchTags, refetchArtists]);
  const { isInLibrary } = useLibraryLookup();

  const isLoading = isTagSearch ? tagLoading : artistLoading;
  const artists = artistData?.artists;
  const tagArtists = tagData?.recommendations;
  const fullData = isTagSearch ? tagArtists : artists;
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

  const scopeLabel = tagScope === "recommended" ? "Recommended" : "All";
  const listHeader = isTagSearch ? (
    <View>
      <Text
        variant="caption"
        style={[styles.subtitle, { color: colors.subtle }]}
      >
        {scopeLabel} artists for tag {`\u201C${tagQuery}\u201D`}
      </Text>
      {IS_ANDROID && <ScopePills scope={tagScope} onChange={setTagScope} />}
    </View>
  ) : null;

  const canBroadenToAll =
    isTagSearch && tagScope === "recommended" && showNoResults;
  const emptyComponent = isLoading ? (
    <SkeletonRows count={8} />
  ) : showNoResults ? (
    <EmptyState
      icon="search-outline"
      message={`No results found for \u201C${query}\u201D`}
      actionLabel={canBroadenToAll ? "Try searching all" : undefined}
      onAction={canBroadenToAll ? () => setTagScope("all") : undefined}
    />
  ) : null;

  return (
    <>
      {IS_IOS && isTagSearch && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="line.3.horizontal.decrease" title="Scope">
            {SCOPE_OPTIONS.map((option) => (
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

      {isTagSearch ? (
        <FlashList
          data={showResults ? (tagArtists as TagArtist[]) : []}
          renderItem={renderTagArtistItem}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : (
        <FlashList
          data={showResults ? (artists as SearchArtist[]) : []}
          renderItem={renderArtistItem}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={listHeader}
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
