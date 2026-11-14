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
import {
  type AlbumSortMode,
  type SortOption,
} from "@/components/library/AlbumSortPicker";
import { EmptyState } from "@/components/library/EmptyState";
import {
  GRID_EDGE_PADDING,
  GridCell,
  gridListStyles,
} from "@/components/ui/GridCell";
import {
  FILTER_MENU_ICON,
  menuOptionActions,
} from "@/components/ui/MenuOptions";
import { useGridListView } from "@/hooks/use-grid-list-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { headerSearchBar } from "@/constants/navigation";
import { Colors } from "@/constants/theme";

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
  /**
   * The filter menu's Show section, from menuOptionSection. Memoize it: a new
   * element rebuilds the native header.
   */
  showSection?: React.ReactElement;
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
  showSection,
}: ReleaseGridProps<T, SortKey>) {
  const colors = Colors[useColorScheme()];
  const view = useGridListView(viewModeKey, "grid");
  const hasGrid = !!renderItem;
  const isGrid = hasGrid && view.isGrid;

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
  const toolbar = useMemo(() => {
    const sortActions = menuOptionActions(sortOptions, sortMode, onSortChange);
    return (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={FILTER_MENU_ICON}
          title={showSection ? "Filters" : "Sort By"}
        >
          {showSection ? (
            <Stack.Toolbar.Menu inline title="Sort By">
              {sortActions}
            </Stack.Toolbar.Menu>
          ) : (
            sortActions
          )}
          {showSection}
          {hasGrid && view.viewMenuSection}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    );
  }, [
    sortOptions,
    sortMode,
    onSortChange,
    showSection,
    hasGrid,
    view.viewMenuSection,
  ]);

  if (isLoading) {
    return (
      <View
        style={[
          gridListStyles.grid,
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
        key={`${sortMode}-${isGrid}`}
        data={items}
        renderItem={({ item }) =>
          renderItem && isGrid ? (
            <GridCell>{renderItem(item)}</GridCell>
          ) : (
            renderListItem(item)
          )
        }
        keyExtractor={keyExtractor}
        numColumns={isGrid ? view.numColumns : 1}
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
          ...(isGrid ? gridListStyles.grid : gridListStyles.rows),
          backgroundColor: colors.background,
        }}
      />

      {bottomSheet}
    </>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingVertical: GRID_EDGE_PADDING * 2,
  },
});
