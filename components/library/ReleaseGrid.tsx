import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack } from "expo-router";
import SwapVert from "@expo/material-symbols/swap_vert.xml";
import Event from "@expo/material-symbols/event.xml";
import CalendarToday from "@expo/material-symbols/calendar_today.xml";
import SortByAlpha from "@expo/material-symbols/sort_by_alpha.xml";
import CloudDownload from "@expo/material-symbols/cloud_download.xml";
import {
  type AlbumSortMode,
  type SortOption,
} from "@/components/library/AlbumSortPicker";
import { EmptyState } from "@/components/library/EmptyState";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

const ANDROID_SORT_ICONS: Record<AlbumSortMode, number> = {
  "date-desc": Event,
  "date-asc": CalendarToday,
  "name-asc": SortByAlpha,
  "name-desc": SortByAlpha,
  missing: CloudDownload,
};

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
      <Stack.SearchBar
        placeholder={searchPlaceholder}
        hideWhenScrolling={false}
        autoCapitalize="none"
        onChangeText={(e) => onSearchChange(e.nativeEvent.text)}
        onCancelButtonPress={() => onSearchChange("")}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={
            process.env.EXPO_OS === "ios" ? "arrow.up.arrow.down" : SwapVert
          }
          title="Sort By"
        >
          {sortOptions.map((option) => (
            <Stack.Toolbar.MenuAction
              key={option.key}
              icon={
                process.env.EXPO_OS === "ios"
                  ? (option.iosIcon as any)
                  : ANDROID_SORT_ICONS[option.key]
              }
              isOn={sortMode === option.key}
              onPress={() => onSortChange(option.key)}
            >
              {option.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlashList
        key={sortMode}
        data={items}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>{renderItem(item)}</View>
        )}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
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
});
