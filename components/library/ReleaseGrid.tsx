import React, { useRef } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import BottomSheet from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import {
  AlbumSortTrigger,
  AlbumSortSheet,
  type AlbumSortMode,
  type SortOption,
} from "@/components/library/AlbumSortPicker";
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
  renderItem,
  keyExtractor,
  bottomSheet,
}: ReleaseGridProps<T>) {
  const colors = Colors[useColorScheme()];
  const sortSheetRef = useRef<BottomSheet>(null);

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
            <View style={styles.sortRow}>
              <AlbumSortTrigger
                selected={sortMode}
                onPress={() => sortSheetRef.current?.snapToIndex(0)}
              />
            </View>
          )
        }
        contentInsetAdjustmentBehavior="automatic"
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
  sortRow: {
    paddingBottom: 12,
  },
});
