import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useNavigation, useRouter } from "expo-router";
import { ArtistCard } from "@/components/library/ArtistCard";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { SearchBar, type SortMode } from "@/components/library/SearchBar";
import { EmptyState } from "@/components/library/EmptyState";
import { useLibraryArtists } from "@/hooks/library/use-library-artists";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import { stripArticle } from "@/lib/strings";
import type { Artist } from "@/lib/types/library";

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
  const navigation = useNavigation();
  const colors = Colors[useColorScheme()];
  const {
    data: artists,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useLibraryArtists();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("alpha");

  useEffect(() => {
    if (IS_IOS) {
      navigation.setOptions({
        headerSearchBarOptions: {
          placeholder: "Search artists...",
          hideWhenScrolling: false,
          autoCapitalize: "none",
          onChangeText: (e: { nativeEvent: { text: string } }) => {
            setSearchQuery(e.nativeEvent.text);
          },
        },
      });
    }
  }, [navigation]);

  const filtered = useMemo(() => {
    if (!artists) return [];
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

  if (isLoading) {
    return <ScreenCenter loading />;
  }

  if (error) {
    return (
      <ScreenCenter>
        <EmptyState
          icon="cloud-offline-outline"
          message="Failed to load library"
          actionLabel="Try Again"
          onAction={() => refetch()}
        />
      </ScreenCenter>
    );
  }

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="arrow.up.arrow.down" title="Sort By">
          {SORT_OPTIONS.map((option) => (
            <Stack.Toolbar.MenuAction
              key={option.key}
              icon={option.icon as any}
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
        ListHeaderComponent={
          IS_IOS ? undefined : (
            <View style={{ paddingHorizontal: CARD_GAP / 2 }}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                sortMode={sortMode}
                onSortChange={setSortMode}
              />
            </View>
          )
        }
        ListEmptyComponent={<EmptyState message="Your library is empty" />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.brand}
          />
        }
      />
    </>
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
