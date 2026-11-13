import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
} from "react-native";
import type { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import type { SearchBarTextEventData } from "react-native-screens";
import { Stack } from "expo-router";
import FilterList from "@expo/material-symbols/filter_list.xml";
import {
  type AlbumSortMode,
  type SortOption,
} from "@/components/library/AlbumSortPicker";
import { EmptyState } from "@/components/library/EmptyState";
import { viewModeMenuSection } from "@/components/ui/ViewModeMenuActions";
import { useGridColumns } from "@/hooks/use-grid-columns";
import { useViewMode } from "@/hooks/use-view-mode";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { headerSearchBar } from "@/constants/navigation";
import { IS_IOS } from "@/constants/platform";
import { Colors } from "@/constants/theme";

const EDGE_PADDING = 12;
const CARD_GAP = 12;
const DRAW_DISTANCE = 800;

type ReleaseGridProps<T, SortKey extends string> = {
  items: T[];
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  sortMode: SortKey;
  onSortChange: (mode: SortKey) => void;
  sortOptions: SortOption<SortKey>[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder: string;
  hasUnderlyingItems: boolean;
  emptyMessage: string;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  noMatchesIcon?: "search-outline";
  /** Omit for items with no artwork: rows only, with no grid or list choice. */
  renderItem?: (item: T) => React.ReactElement;
  renderListItem: (item: T) => React.ReactElement;
  keyExtractor: (item: T) => string;
  bottomSheet?: React.ReactNode;
  /** Where the grid or list choice is stored. Artist pages share the default. */
  viewModeKey?: string;
  /** For a paged list: ask for the next page as the user nears the end. */
  onEndReached?: () => void;
  /** Shows a spinner under the last row while the next page loads. */
  isFetchingNextPage?: boolean;
};

export function ReleaseGrid<T, SortKey extends string = AlbumSortMode>({
  items,
  isLoading,
  refreshing,
  onRefresh,
  sortMode,
  onSortChange,
  sortOptions,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  hasUnderlyingItems,
  emptyMessage,
  emptyIcon = "disc-outline",
  renderItem,
  renderListItem,
  keyExtractor,
  bottomSheet,
  viewModeKey = "artist-releases",
  onEndReached,
  isFetchingNextPage = false,
}: ReleaseGridProps<T, SortKey>) {
  const colors = Colors[useColorScheme()];
  const [storedViewMode, setViewMode] = useViewMode(viewModeKey, "grid");
  const hasGrid = !!renderItem;
  const viewMode = hasGrid ? storedViewMode : "list";
  const gridColumns = useGridColumns(EDGE_PADDING * 2);

  // Stack.SearchBar and Stack.Toolbar rebuild the native header when a prop's
  // identity changes, and a rebuild can drop the Android search icon. Stable
  // handlers and a memoized toolbar keep typing from causing one.
  const handleSearchChange = useCallback(
    (event: NativeSyntheticEvent<SearchBarTextEventData>) =>
      onSearchChange(event.nativeEvent.text),
    [onSearchChange],
  );
  const handleSearchCancel = useCallback(
    () => onSearchChange(""),
    [onSearchChange],
  );
  const toolbar = useMemo(
    () => (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={IS_IOS ? "line.3.horizontal.decrease" : FilterList}
          title="Sort By"
        >
          {sortOptions.map((option) => (
            <Stack.Toolbar.MenuAction
              key={option.key}
              icon={IS_IOS ? (option.iosIcon as any) : option.androidIcon}
              isOn={sortMode === option.key}
              onPress={() => onSortChange(option.key)}
            >
              {option.label}
            </Stack.Toolbar.MenuAction>
          ))}
          {hasGrid && viewModeMenuSection(viewMode, setViewMode)}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    ),
    [sortOptions, sortMode, onSortChange, hasGrid, viewMode, setViewMode],
  );

  if (isLoading) {
    return (
      <View
        style={[
          styles.listContent,
          {
            flex: 1,
            justifyContent: "center",
            backgroundColor: colors.background,
          },
        ]}
      >
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const trimmedQuery = searchQuery.trim();
  const hasQuery = trimmedQuery.length > 0;
  const showNoMatches = hasUnderlyingItems && hasQuery && items.length === 0;
  const showNoUnderlying = !hasUnderlyingItems && items.length === 0;

  const emptyComponent = showNoMatches ? (
    <EmptyState
      icon="search-outline"
      message={`No results matching “${trimmedQuery}”`}
    />
  ) : showNoUnderlying ? (
    <EmptyState icon={emptyIcon} message={emptyMessage} />
  ) : null;

  return (
    <>
      <Stack.SearchBar
        {...headerSearchBar(searchPlaceholder, colors)}
        onChangeText={handleSearchChange}
        onCancelButtonPress={handleSearchCancel}
      />
      {toolbar}
      <FlashList
        key={`${sortMode}-${viewMode}`}
        data={items}
        renderItem={({ item }) =>
          renderItem && viewMode === "grid" ? (
            <View style={styles.gridItem}>{renderItem(item)}</View>
          ) : (
            renderListItem(item)
          )
        }
        keyExtractor={keyExtractor}
        numColumns={viewMode === "grid" ? gridColumns : 1}
        ListEmptyComponent={emptyComponent}
        onEndReached={onEndReached}
        // Two screens, not half a screen, so a fast scroll rarely outruns
        // the next page.
        onEndReachedThreshold={2}
        // Covers start loading before cells scroll in. About ten more ~1 MB
        // decoded covers in memory than FlashList's default of 250.
        drawDistance={DRAW_DISTANCE}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={styles.footer} />
          ) : null
        }
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          ...(viewMode === "grid" ? styles.listContent : styles.rowsContent),
          backgroundColor: colors.background,
        }}
      />

      {bottomSheet}
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: EDGE_PADDING,
    paddingTop: EDGE_PADDING,
  },
  rowsContent: {
    paddingTop: EDGE_PADDING,
  },
  footer: {
    paddingVertical: EDGE_PADDING * 2,
  },
  gridItem: {
    flex: 1,
    paddingHorizontal: CARD_GAP / 2,
    paddingBottom: CARD_GAP,
  },
});
