import { useCallback, useRef, useState, type ReactNode } from "react";
import { Keyboard, ScrollView, StyleSheet, View } from "react-native";
import type { NativeSyntheticEvent } from "react-native";
import type {
  SearchBarCommands,
  SearchBarTextEventData,
} from "react-native-screens";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { EmptyState } from "@/components/library/EmptyState";
import { SearchPreviewRow } from "@/components/search/SearchPreviewRow";
import {
  SearchSectionLabel,
  SeeAllRow,
} from "@/components/search/SearchSections";
import {
  SearchResults,
  type SearchFilter,
} from "@/components/search/SearchResults";
import Mic from "@expo/material-symbols/mic.xml";
import { ShazamSheet } from "@/components/shazam";
import { isShazamAvailable } from "@/modules/shazam";
import { RecentSearches } from "@/components/search/RecentSearches";
import {
  searchQueryKind,
  useSearchResults,
} from "@/hooks/search/use-search-results";
import { useRecentSearches } from "@/hooks/search/use-recent-searches";
import { searchBarColors } from "@/constants/navigation";
import { IS_IOS } from "@/constants/platform";
import { SettingsToolbar } from "@/components/navigation/SettingsToolbar";
import type { RecentSearch } from "@/hooks/search/use-recent-searches";
import type { SearchArtist } from "@/lib/types/search";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { useColors } from "@/hooks/use-colors";

const TAG_PREVIEW_LIMIT = 5;

export default function SearchScreen() {
  const router = useRouter();
  const openArtist = useOpenArtist();
  const colors = useColors();
  const searchBarRef = useRef<SearchBarCommands>(null);

  const [query, setQuery] = useState("");
  // The type-ahead until Search is pressed or a See all row is tapped. Then
  // the same screen shows the full results, with filter pills.
  const [view, setView] = useState<"preview" | "full">("preview");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const recentSearches = useRecentSearches();
  const { add: addRecentSearch } = recentSearches;

  const results = useSearchResults(query);
  const { isTagSearch, hasQuery, tags } = results;

  const pushTagResults = useCallback(
    (tag: string) => {
      Keyboard.dismiss();
      addRecentSearch({ type: "tag", text: tag });
      router.push({ pathname: "/results", params: { q: `#${tag}` } });
    },
    [router, addRecentSearch],
  );

  const showFullResults = useCallback(
    (q: string, next: SearchFilter) => {
      searchBarRef.current?.blur();
      addRecentSearch({ type: "query", text: q });
      setFilter(next);
      setView("full");
    },
    [addRecentSearch],
  );

  // A search started from a recent search or Shazam fills the bar, as if
  // typed, and goes straight to the full results.
  const searchFor = useCallback(
    (q: string, next: SearchFilter) => {
      searchBarRef.current?.setText(q);
      setQuery(q);
      showFullResults(q, next);
    },
    [showFullResults],
  );

  // Stack.SearchBar re-registers its native header options whenever a prop
  // identity changes. Keep every handler stable so typing does not churn the
  // header config — on Android the toolbar menu that hosts the search icon is
  // rebuilt from it, and rebuilds can drop the icon (react-native-screens
  // issue #2271).
  const handleChangeText = useCallback(
    (e: NativeSyntheticEvent<SearchBarTextEventData>) => {
      const text = e.nativeEvent.text;
      setQuery(text);
      if (!text.trim()) setView("preview");
    },
    [],
  );

  const handleCancelSearch = useCallback(() => {
    setQuery("");
    setView("preview");
  }, []);

  const handleSearchSubmit = useCallback(
    (e: NativeSyntheticEvent<SearchBarTextEventData>) => {
      const q = e.nativeEvent.text.trim();
      const kind = searchQueryKind(q);
      if (kind.isTagSearch) {
        if (kind.hasQuery) pushTagResults(kind.tag);
      } else if (kind.hasQuery) {
        showFullResults(q, "all");
      }
    },
    [pushTagResults, showFullResults],
  );

  const handleFilterChange = (next: SearchFilter) =>
    view === "full" ? setFilter(next) : showFullResults(query.trim(), next);

  const rememberArtist = useCallback(
    (artist: SearchArtist) =>
      addRecentSearch({ type: "artist", text: artist.name, mbid: artist.id }),
    [addRecentSearch],
  );

  const shazamSheetRef = useRef<BottomSheetModal | null>(null);
  const handleShazamArtist = useCallback(
    (mbid: string, name: string) => openArtist({ mbid, name }),
    [openArtist],
  );

  let content: ReactNode = null;
  if (!hasQuery) {
    content =
      recentSearches.searches.length > 0 ? (
        <RecentSearches
          searches={recentSearches.searches}
          onSelect={(entry: RecentSearch) => {
            if (entry.type === "artist") {
              openArtist({ mbid: entry.mbid, name: entry.text });
            } else if (entry.type === "tag") {
              pushTagResults(entry.text);
            } else {
              searchFor(entry.text, "all");
            }
          }}
          onRemove={recentSearches.remove}
          onClear={recentSearches.clear}
        />
      ) : (
        <EmptyState
          icon="search-outline"
          message="Search for artists, songs, playlists or #tags"
        />
      );
  } else if (isTagSearch) {
    content =
      tags.length > 0 ? (
        <View style={styles.tags}>
          <SearchSectionLabel text="Tags" />
          {tags.slice(0, TAG_PREVIEW_LIMIT).map((tag) => (
            <SearchPreviewRow
              key={`tag-${tag}`}
              icon="pricetag-outline"
              iconColor={colors.brandStrong}
              label={`#${tag}`}
              onPress={() => pushTagResults(tag)}
            />
          ))}
          {tags.length > TAG_PREVIEW_LIMIT && (
            <SeeAllRow
              label="See all tag results"
              onPress={() => pushTagResults(searchQueryKind(query).tag)}
            />
          )}
        </View>
      ) : (
        <EmptyState
          icon="search-outline"
          message={`No results for “${query.trim()}”`}
        />
      );
  }

  return (
    <>
      <Stack.SearchBar
        ref={searchBarRef}
        placeholder="Artists, songs, playlists, #tags..."
        hideWhenScrolling={false}
        autoCapitalize="none"
        {...searchBarColors(colors)}
        onChangeText={handleChangeText}
        onCancelButtonPress={handleCancelSearch}
        onSearchButtonPress={handleSearchSubmit}
      />
      <SettingsToolbar />
      <Stack.Toolbar placement="right">
        {isShazamAvailable && (
          <Stack.Toolbar.Button
            icon={IS_IOS ? "mic" : Mic}
            accessibilityLabel="Identify song"
            onPress={() => shazamSheetRef.current?.present()}
          >
            Identify song
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {content}
        <SearchResults
          query={query}
          results={results}
          view={view}
          filter={filter}
          onFilterChange={handleFilterChange}
          onTagPress={pushTagResults}
          onArtistOpen={rememberArtist}
        />
      </ScrollView>
      <ShazamSheet
        sheetRef={shazamSheetRef}
        onViewArtist={handleShazamArtist}
        onViewRelease={(params) =>
          router.push({ pathname: "/release/[mbid]", params })
        }
        onSearchManually={(q) => searchFor(q, "artists")}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tags: {
    paddingTop: 4,
  },
});

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load search" />;
}
