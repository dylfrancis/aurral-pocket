import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SearchBar } from "@/components/library/SearchBar";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonRows } from "@/components/search/SkeletonRows";
import { SearchPreviewRow } from "@/components/search/SearchPreviewRow";
import { RecentSearches } from "@/components/search/RecentSearches";
import { Text } from "@/components/ui/Text";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import { useTagSuggestions } from "@/hooks/search/use-tag-suggestions";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useRecentSearches } from "@/hooks/search/use-recent-searches";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { IS_ANDROID, IS_IOS } from "@/constants/platform";
import type { RecentSearch } from "@/hooks/search/use-recent-searches";
import type { SearchArtist } from "@/lib/types/search";
const PREVIEW_LIMIT = 5;

export default function SearchScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  const [query, setQuery] = useState("");
  const recentSearches = useRecentSearches();

  const isTagSearch = query.trimStart().startsWith("#");
  const tagQuery = isTagSearch ? query.trimStart().slice(1).trim() : "";
  const artistQuery = isTagSearch ? "" : query;
  const hasQuery =
    query.trim().length >= 2 || (isTagSearch && tagQuery.length >= 2);

  const {
    data: artistData,
    isLoading: artistLoading,
    isFetching: artistFetching,
  } = useArtistSearch(artistQuery);

  const [showSlowLoader, setShowSlowLoader] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (artistFetching && hasQuery && !isTagSearch) {
      slowTimer.current = setTimeout(() => setShowSlowLoader(true), 1000);
    } else {
      setShowSlowLoader(false);
    }
    return () => clearTimeout(slowTimer.current);
  }, [artistFetching, hasQuery, isTagSearch]);
  const { data: tags } = useTagSuggestions(
    isTagSearch ? tagQuery : artistQuery,
  );
  const { isInLibrary } = useLibraryLookup();

  const artists = artistData?.artists;

  const pushResults = useCallback(
    (q: string) => {
      Keyboard.dismiss();
      if (q.startsWith("#")) {
        recentSearches.add({ type: "tag", text: q.slice(1) });
      } else {
        recentSearches.add({ type: "query", text: q });
      }
      router.push({
        pathname: "/results",
        params: { q },
      });
    },
    [router, recentSearches],
  );

  const handleSubmit = useCallback(() => {
    if (query.trim()) pushResults(query.trim());
  }, [query, pushResults]);

  const handleTagSelect = useCallback(
    (tag: string) => pushResults(`#${tag}`),
    [pushResults],
  );

  const handleArtistPress = useCallback(
    (artist: SearchArtist) => {
      recentSearches.add({
        type: "artist",
        text: artist.name,
        mbid: artist.id,
      });
      router.push({
        pathname: "/artist/[mbid]",
        params: { mbid: artist.id, name: artist.name },
      });
    },
    [router, recentSearches],
  );

  useEffect(() => {
    if (IS_IOS) {
      navigation.setOptions({
        headerSearchBarOptions: {
          placeholder: "Artists, bands, #tags...",
          hideWhenScrolling: false,
          autoCapitalize: "none",
          onChangeText: (e: { nativeEvent: { text: string } }) => {
            setQuery(e.nativeEvent.text);
          },
          onCancelButtonPress: () => setQuery(""),
          onSearchButtonPress: handleSubmit,
        },
      });
    }
  }, [navigation, handleSubmit]);

  const previewTags = hasQuery
    ? (tags ?? []).slice(0, isTagSearch ? PREVIEW_LIMIT : 3)
    : [];
  const previewArtists =
    hasQuery && !isTagSearch ? (artists ?? []).slice(0, PREVIEW_LIMIT) : [];
  const previewLoading =
    hasQuery && !isTagSearch && (artistLoading || showSlowLoader);
  const hasPreviewContent = previewTags.length > 0 || previewArtists.length > 0;

  let content;

  if (hasQuery && previewLoading) {
    content = <SkeletonRows />;
  } else if (hasQuery && hasPreviewContent) {
    content = (
      <View style={styles.previewSection}>
        {previewTags.map((tag) => (
          <SearchPreviewRow
            key={`tag-${tag}`}
            icon="pricetag-outline"
            iconColor={colors.brandStrong}
            label={`#${tag}`}
            onPress={() => handleTagSelect(tag)}
          />
        ))}
        {previewArtists.map((artist) => (
          <SearchPreviewRow
            key={artist.id}
            icon="person-outline"
            label={artist.name}
            onPress={() => handleArtistPress(artist)}
            trailing={
              <>
                {isInLibrary(artist.id) && (
                  <Text variant="caption" style={{ color: colors.brandStrong }}>
                    In Library
                  </Text>
                )}
                <Ionicons
                  name="arrow-forward-outline"
                  size={16}
                  color={colors.subtle}
                />
              </>
            }
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
            <Text
              variant="body"
              style={[styles.seeAllText, { color: colors.brand }]}
            >
              See all results
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brand} />
          </Pressable>
        )}
      </View>
    );
  } else if (hasQuery) {
    content = (
      <EmptyState
        icon="search-outline"
        message={`No results for \u201C${query.trim()}\u201D`}
      />
    );
  } else if (recentSearches.searches.length > 0) {
    content = (
      <RecentSearches
        searches={recentSearches.searches}
        onSelect={(entry: RecentSearch) => {
          if (entry.type === "artist") {
            router.push({
              pathname: "/artist/[mbid]",
              params: { mbid: entry.mbid, name: entry.text },
            });
          } else if (entry.type === "tag") {
            pushResults(`#${entry.text}`);
          } else {
            pushResults(entry.text);
          }
        }}
        onRemove={recentSearches.remove}
        onClear={recentSearches.clear}
      />
    );
  } else {
    content = (
      <EmptyState
        icon="search-outline"
        message="Search for artists or #tags to discover music"
      />
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={Keyboard.dismiss}
    >
      {IS_ANDROID && (
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
      {content}
    </ScrollView>
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
  seeAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 4,
  },
  seeAllText: {
    fontFamily: Fonts.semiBold,
  },
});
