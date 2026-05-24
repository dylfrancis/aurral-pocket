import { useCallback, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

export type NearbyShowsSort = "date" | "distance" | "artist";
export type NearbyShowsDateRange = "all" | "weekend" | "next30";
export type NearbyShowsSource = "all" | "library" | "recommended";

export const SORT_OPTIONS: { value: NearbyShowsSort; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "distance", label: "Distance" },
  { value: "artist", label: "Artist (A–Z)" },
];

export const DATE_RANGE_OPTIONS: {
  value: NearbyShowsDateRange;
  label: string;
}[] = [
  { value: "all", label: "All upcoming" },
  { value: "weekend", label: "This weekend" },
  { value: "next30", label: "Next 30 days" },
];

export const SOURCE_OPTIONS: { value: NearbyShowsSource; label: string }[] = [
  { value: "all", label: "All" },
  { value: "library", label: "Library" },
  { value: "recommended", label: "Recommended" },
];

type Props = {
  visible: boolean;
  sort: NearbyShowsSort;
  dateRange: NearbyShowsDateRange;
  source: NearbyShowsSource;
  onChangeSort: (next: NearbyShowsSort) => void;
  onChangeDateRange: (next: NearbyShowsDateRange) => void;
  onChangeSource: (next: NearbyShowsSource) => void;
  onClose: () => void;
};

export function NearbyShowsFilterSheet(props: Props) {
  if (!props.visible) return null;
  return <NearbyShowsFilterSheetContent {...props} />;
}

function NearbyShowsFilterSheetContent({
  sort,
  dateRange,
  source,
  onChangeSort,
  onChangeDateRange,
  onChangeSource,
  onClose,
}: Props) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (backdropProps: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      <BottomSheetView
        style={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text
            variant="title"
            style={[
              styles.title,
              { color: colors.text, fontFamily: Fonts.semiBold },
            ]}
          >
            Filters
          </Text>

          <FilterGroup label="Show">
            {SOURCE_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.value}
                label={opt.label}
                selected={source === opt.value}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onChangeSource(opt.value);
                }}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Sort by">
            {SORT_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.value}
                label={opt.label}
                selected={sort === opt.value}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onChangeSort(opt.value);
                }}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Date range">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.value}
                label={opt.label}
                selected={dateRange === opt.value}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onChangeDateRange(opt.value);
                }}
              />
            ))}
          </FilterGroup>
        </ScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const colors = Colors[useColorScheme()];
  return (
    <View style={styles.group}>
      <Text
        variant="caption"
        style={[
          styles.groupLabel,
          { color: colors.subtle, fontFamily: Fonts.semiBold },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      <View style={[styles.groupBody, { borderColor: colors.separator }]}>
        {children}
      </View>
    </View>
  );
}

function OptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = Colors[useColorScheme()];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        { borderColor: colors.separator, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text
        variant="body"
        style={[
          styles.optionLabel,
          {
            color: colors.text,
            fontFamily: selected ? Fonts.semiBold : Fonts.regular,
          },
        ]}
      >
        {label}
      </Text>
      {selected && (
        <View style={[styles.checkDot, { backgroundColor: colors.brand }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 20,
    marginBottom: 16,
  },
  group: {
    marginBottom: 20,
  },
  groupLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  groupBody: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    fontSize: 15,
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
