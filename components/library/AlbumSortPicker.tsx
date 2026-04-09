import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

export type AlbumSortMode = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'missing';

export type SortOption = {
  key: AlbumSortMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iosIcon: string;
};

export const ALBUM_SORT_OPTIONS: SortOption[] = [
  { key: 'date-desc', label: 'Newest First', icon: 'calendar-outline', iosIcon: 'calendar.badge.clock' },
  { key: 'date-asc', label: 'Oldest First', icon: 'calendar-outline', iosIcon: 'calendar' },
  { key: 'name-asc', label: 'Name A-Z', icon: 'text-outline', iosIcon: 'textformat.abc' },
  { key: 'name-desc', label: 'Name Z-A', icon: 'text-outline', iosIcon: 'textformat.abc' },
  { key: 'missing', label: 'Missing', icon: 'cloud-download-outline', iosIcon: 'icloud.and.arrow.down' },
];

type AlbumSortTriggerProps = {
  selected: AlbumSortMode;
  onPress: () => void;
};

export function AlbumSortTrigger({ selected, onPress }: AlbumSortTriggerProps) {
  const colors = Colors[useColorScheme()];
  const currentLabel = ALBUM_SORT_OPTIONS.find((o) => o.key === selected)?.label ?? '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.trigger,
        {
          backgroundColor: `${colors.brand}20`,
          borderColor: colors.brand,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name="swap-vertical" size={14} color={colors.brand} />
      <Text variant="caption" style={[styles.triggerLabel, { color: colors.brand }]}>
        {currentLabel}
      </Text>
    </Pressable>
  );
}

type AlbumSortSheetProps = {
  sheetRef: React.RefObject<BottomSheet | null>;
  selected: AlbumSortMode;
  onChange: (mode: AlbumSortMode) => void;
  options?: typeof ALBUM_SORT_OPTIONS;
};

export function AlbumSortSheet({ sheetRef, selected, onChange, options = ALBUM_SORT_OPTIONS }: AlbumSortSheetProps) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();

  const selectOption = useCallback(
    (key: AlbumSortMode) => {
      onChange(key);
      sheetRef.current?.close();
    },
    [onChange, sheetRef],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      enablePanDownToClose
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}>
        <Text variant="subtitle" style={[styles.sheetTitle, { color: colors.text }]}>
          Sort By
        </Text>
        {options.map((option) => {
          const active = selected === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => selectOption(option.key)}
              style={({ pressed }) => [
                styles.option,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons
                name={option.icon}
                size={18}
                color={active ? colors.brand : colors.subtle}
              />
              <Text
                variant="body"
                style={[
                  styles.optionLabel,
                  { color: active ? colors.brand : colors.text },
                ]}
              >
                {option.label}
              </Text>
              {active && (
                <Ionicons name="checkmark" size={18} color={colors.brand} style={styles.check} />
              )}
            </Pressable>
          );
        })}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  triggerLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  sheetContent: {
    paddingHorizontal: 16,
  },
  sheetTitle: {
    fontFamily: Fonts.semiBold,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  optionLabel: {
    flex: 1,
    fontFamily: Fonts.medium,
  },
  check: {
    marginLeft: 'auto',
  },
});
