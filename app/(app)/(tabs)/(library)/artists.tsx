import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import Block from "@expo/material-symbols/block.xml";
import SortByAlpha from "@expo/material-symbols/sort_by_alpha.xml";
import Schedule from "@expo/material-symbols/schedule.xml";
import LibraryMusic from "@expo/material-symbols/library_music.xml";
import { AlphabetIndex } from "@/components/library/AlphabetIndex";
import { ArtistCard } from "@/components/library/ArtistCard";
import { MediaRow } from "@/components/ui/MediaRow";
import {
  FILTER_MENU_ICON,
  menuOptionActions,
  type MenuOption,
} from "@/components/ui/MenuOptions";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import {
  GRID_EDGE_PADDING,
  GridCell,
  gridListStyles,
} from "@/components/ui/GridCell";
import { type SortMode } from "@/components/library/SearchBar";
import { EmptyState } from "@/components/library/EmptyState";
import { useLibraryArtistsSuspense } from "@/hooks/library/use-library-artists";
import { useGridListView } from "@/hooks/use-grid-list-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { SEARCH_PLACEHOLDERS, headerSearchBar } from "@/constants/navigation";
import { Colors } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import { buildLetterIndex, type LetterIndexEntry } from "@/lib/alphabet-index";
import { artistRouteId } from "@/lib/library-read";
import { stripArticle } from "@/lib/strings";
import type { Artist } from "@/lib/types/library";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

const byName = (a: Artist, b: Artist) =>
  stripArticle(a.artistName).localeCompare(stripArticle(b.artistName));

/** Milliseconds since the epoch, or null when the server sent no usable date. */
function addedTime(artist: Artist): number | null {
  if (!artist.addedAt) return null;
  const time = new Date(artist.addedAt).getTime();
  return Number.isNaN(time) ? null : time;
}

const SORT_OPTIONS: MenuOption<SortMode>[] = [
  {
    key: "alpha",
    label: "Alphabetical",
    iosIcon: "textformat.abc",
    androidIcon: SortByAlpha,
  },
  {
    key: "recent",
    label: "Recently Added",
    iosIcon: "clock",
    androidIcon: Schedule,
  },
  {
    key: "albums",
    label: "Album Count",
    iosIcon: "square.stack",
    androidIcon: LibraryMusic,
  },
];

export default function LibraryArtistsScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const { data: artists, refetch } = useLibraryArtistsSuspense();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
  const { isGrid, numColumns, viewMenuSection } = useGridListView(
    "library-artists",
    "grid",
  );
  const listRef = useRef<FlashListRef<Artist>>(null);

  const filtered = useMemo(() => {
    if (!searchQuery) return artists;
    const query = searchQuery.toLowerCase();
    return artists.filter((a) => a.artistName.toLowerCase().includes(query));
  }, [artists, searchQuery]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortMode) {
      case "alpha":
        return list.sort(byName);
      case "recent":
        // The canonical read path records no added date, so every artist can
        // sort as undated. Undated artists go last in alphabetical order, so
        // the list stays stable instead of showing the server's own order.
        return list.sort((a, b) => {
          const left = addedTime(a);
          const right = addedTime(b);
          if (left === right) return byName(a, b);
          if (left === null) return 1;
          if (right === null) return -1;
          return right - left;
        });
      case "albums":
        return list.sort(
          (a, b) => b.statistics.albumCount - a.statistics.albumCount,
        );
    }
  }, [filtered, sortMode]);

  const letterIndex = useMemo(() => {
    if (sortMode !== "alpha") return [];
    return buildLetterIndex(sorted.map((artist) => artist.artistName));
  }, [sorted, sortMode]);

  // Scroll targets subtract the header height because contentOffset 0 sits
  // under the translucent header. Jumps use getLayout + scrollToOffset (one
  // native call) instead of scrollToIndex, whose multi-step render loop lags
  // behind a fast scrub. requestAnimationFrame coalesces crossings so at most
  // one jump lands per frame, and the newest letter wins.
  const headerHeight = useHeaderHeight();
  const pendingEntry = useRef<LetterIndexEntry | null>(null);
  const scrollScheduled = useRef(false);
  const handleLetterSelect = useCallback(
    (entry: LetterIndexEntry) => {
      pendingEntry.current = entry;
      if (scrollScheduled.current) return;
      scrollScheduled.current = true;
      requestAnimationFrame(() => {
        scrollScheduled.current = false;
        const target = pendingEntry.current;
        const list = listRef.current;
        if (!target || !list) return;
        if (target.index === 0) {
          list.scrollToOffset({ offset: -headerHeight, animated: false });
          return;
        }
        const layout = list.getLayout(target.index);
        if (!layout) {
          list.scrollToIndex({
            index: target.index,
            animated: false,
            viewOffset: -headerHeight,
          });
          return;
        }
        const maxOffset = Math.max(
          0,
          list.getChildContainerDimensions().height -
            list.getWindowSize().height,
        );
        list.scrollToOffset({
          offset: Math.min(
            layout.y + GRID_EDGE_PADDING - headerHeight,
            maxOffset,
          ),
          animated: false,
        });
      });
    },
    [headerHeight],
  );

  const { refreshing, onRefresh } = usePullToRefresh(
    refetch,
    "Couldn't refresh library",
  );

  const openArtist = useCallback(
    (artist: Artist) => {
      router.push({
        pathname: "/artist/[mbid]",
        params: {
          mbid: artistRouteId(artist),
          name: artist.artistName,
          coverUrl: artist.coverUrl ?? "",
        },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Artist }) => {
      if (!isGrid) {
        const { albumCount } = item.statistics;
        return (
          <MediaRow
            imageType="artist"
            mbid={item.mbid}
            coverUrl={item.coverUrl}
            title={item.artistName}
            subtitle={`${albumCount} ${albumCount === 1 ? "album" : "albums"}`}
            onPress={() => openArtist(item)}
          />
        );
      }
      return (
        <GridCell>
          <ArtistCard artist={item} onPress={() => openArtist(item)} />
        </GridCell>
      );
    },
    [openArtist, isGrid],
  );

  return (
    <>
      <Stack.SearchBar
        {...headerSearchBar(SEARCH_PLACEHOLDERS.artists, colors)}
        onChangeText={(e) => setSearchQuery(e.nativeEvent.text)}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={IS_IOS ? "nosign" : Block}
          accessibilityLabel="Blocklist"
          onPress={() => router.push("/blocklist")}
        >
          Blocklist
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Menu icon={FILTER_MENU_ICON} title="Sort By">
          {menuOptionActions(SORT_OPTIONS, sortMode, setSortMode)}
          {viewMenuSection}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <View style={styles.listWrapper}>
        <FlashList
          key={`${sortMode}-${isGrid}`}
          ref={listRef}
          data={sorted}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          // The native scrollTo command clamps negative offsets to the raw
          // contentInset (0), which blocks jumps into the adjusted header
          // inset; this prop disables that clamp.
          scrollToOverflowEnabled
          ListEmptyComponent={<EmptyState message="Your library is empty" />}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            // Rows carry their own horizontal padding; only the grid needs
            // it on the container. paddingTop stays in both modes because
            // the letter-jump offset math adds GRID_EDGE_PADDING.
            ...(isGrid ? gridListStyles.grid : gridListStyles.rows),
            backgroundColor: colors.background,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
            />
          }
        />
        {letterIndex.length > 0 && (
          <AlphabetIndex entries={letterIndex} onSelect={handleLetterSelect} />
        )}
      </View>
    </>
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ScreenCenter>
      <EmptyState
        icon="cloud-offline-outline"
        message="Failed to load library"
        actionLabel="Try Again"
        onAction={() => {
          reset();
          retry();
        }}
      />
    </ScreenCenter>
  );
}

const styles = StyleSheet.create({
  listWrapper: {
    flex: 1,
  },
});
