import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import * as Burnt from "burnt";
import SwapVert from "@expo/material-symbols/swap_vert.xml";
import SortByAlpha from "@expo/material-symbols/sort_by_alpha.xml";
import Schedule from "@expo/material-symbols/schedule.xml";
import LibraryMusic from "@expo/material-symbols/library_music.xml";
import { ArtistCard } from "@/components/library/ArtistCard";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { type SortMode } from "@/components/library/SearchBar";
import { EmptyState } from "@/components/library/EmptyState";
import { useLibraryArtistsSuspense } from "@/hooks/library/use-library-artists";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
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
        onChangeText={(e) => setSearchQuery(e.nativeEvent.text)}
      />
      <Stack.Toolbar placement="right">
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
      <FlashList
        key={sortMode}
        data={sorted}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
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
