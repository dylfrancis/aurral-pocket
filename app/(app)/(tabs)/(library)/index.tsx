import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import * as Burnt from "burnt";
import SwapVert from "@expo/material-symbols/swap_vert.xml";
import Block from "@expo/material-symbols/block.xml";
import SortByAlpha from "@expo/material-symbols/sort_by_alpha.xml";
import Schedule from "@expo/material-symbols/schedule.xml";
import LibraryMusic from "@expo/material-symbols/library_music.xml";
import { AlphabetIndex } from "@/components/library/AlphabetIndex";
import { ArtistCard } from "@/components/library/ArtistCard";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { type SortMode } from "@/components/library/SearchBar";
import { EmptyState } from "@/components/library/EmptyState";
import { useLibraryArtistsSuspense } from "@/hooks/library/use-library-artists";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { searchBarColors } from "@/constants/navigation";
import { Colors } from "@/constants/theme";
import { buildLetterIndex, type LetterIndexEntry } from "@/lib/alphabet-index";
import { stripArticle } from "@/lib/strings";
import type { Artist } from "@/lib/types/library";

const SORT_ICONS = {
  alpha: SortByAlpha,
  recent: Schedule,
  albums: LibraryMusic,
} satisfies Record<SortMode, unknown>;

const EDGE_PADDING = 12;
const CARD_GAP = 12;
const NUM_COLUMNS = 2;

const SORT_OPTIONS: { key: SortMode; label: string; icon: string }[] = [
  { key: "alpha", label: "Alphabetical", icon: "textformat.abc" },
  { key: "recent", label: "Recently Added", icon: "clock" },
  { key: "albums", label: "Album Count", icon: "square.stack" },
];

export default function LibraryScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const { data: artists, refetch, isRefetching } = useLibraryArtistsSuspense();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
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
        return list.sort((a, b) =>
          stripArticle(a.artistName).localeCompare(stripArticle(b.artistName)),
        );
      case "recent":
        return list.sort(
          (a, b) =>
            new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
        );
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
          offset: Math.min(layout.y + EDGE_PADDING - headerHeight, maxOffset),
          animated: false,
        });
      });
    },
    [headerHeight],
  );

  const handleRefresh = useCallback(async () => {
    const result = await refetch();
    if (result.isError) {
      Burnt.toast({
        title: "Couldn't refresh library",
        preset: "error",
      });
    }
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: Artist }) => {
      return (
        <View style={styles.gridItem}>
          <ArtistCard
            artist={item}
            onPress={() => router.push(`/artist/${item.mbid}`)}
          />
        </View>
      );
    },
    [router],
  );

  return (
    <>
      <Stack.SearchBar
        placeholder="Search artists..."
        hideWhenScrolling={false}
        autoCapitalize="none"
        {...searchBarColors(colors)}
        onChangeText={(e) => setSearchQuery(e.nativeEvent.text)}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={process.env.EXPO_OS === "ios" ? "nosign" : Block}
          accessibilityLabel="Blocklist"
          onPress={() => router.push("/blocklist")}
        >
          Blocklist
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Menu
          icon={
            process.env.EXPO_OS === "ios" ? "arrow.up.arrow.down" : SwapVert
          }
          title="Sort By"
        >
          {SORT_OPTIONS.map((option) => (
            <Stack.Toolbar.MenuAction
              key={option.key}
              icon={
                process.env.EXPO_OS === "ios"
                  ? (option.icon as any)
                  : SORT_ICONS[option.key]
              }
              isOn={sortMode === option.key}
              onPress={() => setSortMode(option.key)}
            >
              {option.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <View style={styles.listWrapper}>
        <FlashList
          key={sortMode}
          ref={listRef}
          data={sorted}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          // The native scrollTo command clamps negative offsets to the raw
          // contentInset (0), which blocks jumps into the adjusted header
          // inset; this prop disables that clamp.
          scrollToOverflowEnabled
          ListEmptyComponent={<EmptyState message="Your library is empty" />}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            ...styles.listContent,
            backgroundColor: colors.background,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
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
  listContent: {
    paddingHorizontal: EDGE_PADDING,
    paddingTop: EDGE_PADDING,
  },
  gridItem: {
    flex: 1,
    paddingHorizontal: CARD_GAP / 2,
    paddingBottom: CARD_GAP,
  },
});
