import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { NEARBY_RADIUS_OPTIONS } from "@/hooks/discover/use-nearby-location-pref";

export type NearbyShowsSort = "date" | "distance" | "artist";
export type NearbyShowsDateRange = "all" | "weekend" | "next30";

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

type Props = {
  visible: boolean;
  sort: NearbyShowsSort;
  dateRange: NearbyShowsDateRange;
  radiusMiles: number;
  onChangeSort: (next: NearbyShowsSort) => void;
  onChangeDateRange: (next: NearbyShowsDateRange) => void;
  onChangeRadius: (next: number) => void;
  onClose: () => void;
};

export function NearbyShowsFilterSheet(props: Props) {
  if (!props.visible) return null;
  return <NearbyShowsFilterSheetContent {...props} />;
}

function NearbyShowsFilterSheetContent({
  sort,
  dateRange,
  radiusMiles,
  onChangeSort,
  onChangeDateRange,
  onChangeRadius,
  onClose,
}: Props) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();

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

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose],
  );

  return (
    <BottomSheet
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onChange={handleSheetChange}
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

          <FilterGroup label="Search radius">
            {NEARBY_RADIUS_OPTIONS.map((miles) => (
              <OptionRow
                key={miles}
                label={`${miles} miles`}
                selected={radiusMiles === miles}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onChangeRadius(miles);
                }}
              />
            ))}
          </FilterGroup>
        </ScrollView>
      </BottomSheetView>
    </BottomSheet>
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
