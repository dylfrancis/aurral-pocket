import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Stack, useNavigation } from "expo-router";
import {
  AlbumSortTrigger,
  AlbumSortSheet,
  type AlbumSortMode,
  type SortOption,
} from "@/components/library/AlbumSortPicker";
import { SearchBar } from "@/components/library/SearchBar";
import { EmptyState } from "@/components/library/EmptyState";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { IS_ANDROID, IS_IOS } from "@/constants/platform";

const EDGE_PADDING = 12;
const CARD_GAP = 12;
const NUM_COLUMNS = 2;

type ReleaseGridProps<T> = {
  items: T[];
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  sortMode: AlbumSortMode;
  onSortChange: (mode: AlbumSortMode) => void;
  sortOptions: SortOption[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder: string;
  hasUnderlyingItems: boolean;
  emptyMessage: string;
  noMatchesIcon?: "search-outline";
  renderItem: (item: T) => React.ReactElement;
  keyExtractor: (item: T) => string;
  bottomSheet?: React.ReactNode;
};

export function ReleaseGrid<T>({
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
  renderItem,
  keyExtractor,
  bottomSheet,
}: ReleaseGridProps<T>) {
  const colors = Colors[useColorScheme()];
  const sortSheetRef = useRef<BottomSheetModal>(null);
  const navigation = useNavigation();

  useEffect(() => {
    if (!IS_IOS) return;
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: searchPlaceholder,
        hideWhenScrolling: false,
        autoCapitalize: "none",
        onChangeText: (e: { nativeEvent: { text: string } }) => {
          onSearchChange(e.nativeEvent.text);
        },
        onCancelButtonPress: () => onSearchChange(""),
      },
    });
  }, [navigation, searchPlaceholder, onSearchChange]);

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
    <EmptyState icon="disc-outline" message={emptyMessage} />
  ) : null;

  return (
    <>
      {IS_IOS && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="arrow.up.arrow.down" title="Sort By">
            {sortOptions.map((option) => (
              <Stack.Toolbar.MenuAction
                key={option.key}
                icon={option.iosIcon as any}
                isOn={sortMode === option.key}
                onPress={() => onSortChange(option.key)}
              >
                {option.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}
      <FlashList
        key={sortMode}
        data={items}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>{renderItem(item)}</View>
        )}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
        ListHeaderComponent={
          IS_IOS ? undefined : (
            <View style={styles.androidHeader}>
              <SearchBar
                value={searchQuery}
                onChangeText={onSearchChange}
                sortMode="alpha"
                onSortChange={() => {}}
                showSort={false}
                placeholder={searchPlaceholder}
              />
              <View style={styles.sortRow}>
                <AlbumSortTrigger
                  selected={sortMode}
                  onPress={() => sortSheetRef.current?.present()}
                />
              </View>
            </View>
          )
        }
        ListEmptyComponent={emptyComponent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          ...styles.listContent,
          backgroundColor: colors.background,
        }}
      />

      {IS_ANDROID && (
        <AlbumSortSheet
          sheetRef={sortSheetRef}
          selected={sortMode}
          onChange={onSortChange}
          options={sortOptions}
        />
      )}

      {bottomSheet}
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
  androidHeader: {
    paddingHorizontal: CARD_GAP / 2,
  },
  sortRow: {
    paddingBottom: 12,
  },
});
