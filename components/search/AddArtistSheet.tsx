import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useAddArtist } from "@/hooks/search/use-add-artist";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { MonitorOption } from "@/lib/types/search";

type AddArtistSheetProps = {
  mbid: string;
  artistName: string;
  sheetRef: React.RefObject<BottomSheet | null>;
  onAdded?: () => void;
};

const MONITOR_OPTIONS: {
  value: MonitorOption;
  label: string;
  description: string;
}[] = [
  {
    value: "none",
    label: "None",
    description: "Artist only, no albums monitored",
  },
  { value: "all", label: "All Albums", description: "Monitor all albums" },
  { value: "future", label: "Future Albums", description: "Only new releases" },
  {
    value: "missing",
    label: "Missing Albums",
    description: "Albums not yet downloaded",
  },
  {
    value: "latest",
    label: "Latest Album",
    description: "Only the latest album",
  },
  { value: "first", label: "First Album", description: "Only the first album" },
];

export function AddArtistSheet({
  mbid,
  artistName,
  sheetRef,
  onAdded,
}: AddArtistSheetProps) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const [selectedOption, setSelectedOption] = useState<MonitorOption>("all");

  const addArtist = useAddArtist(() => {
    sheetRef.current?.close();
    onAdded?.();
  });

  const handleAdd = useCallback(() => {
    addArtist.mutate({
      foreignArtistId: mbid,
      artistName,
      monitorOption: selectedOption,
    });
  }, [addArtist, mbid, artistName, selectedOption]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["85%"]}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        <View style={styles.header}>
          <Text variant="title" style={styles.title}>
            Add to Library
          </Text>
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: colors.subtle }}
          >
            {artistName}
          </Text>
        </View>

        <View style={styles.optionsSection}>
          <Text
            variant="caption"
            style={[styles.sectionLabel, { color: colors.subtle }]}
          >
            Monitor Option
          </Text>
          {MONITOR_OPTIONS.map((option) => {
            const isSelected = selectedOption === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setSelectedOption(option.value)}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    borderBottomColor: colors.separator,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={isSelected ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={isSelected ? colors.brand : colors.subtle}
                />
                <View style={styles.optionMeta}>
                  <Text
                    variant="body"
                    style={[
                      styles.optionLabel,
                      isSelected && { color: colors.brand },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text variant="caption" style={{ color: colors.subtle }}>
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleAdd}
            disabled={addArtist.isPending}
          >
            {addArtist.isPending ? (
              <ActivityIndicator size={18} color="#fff" />
            ) : addArtist.isSuccess ? (
              <Ionicons name="checkmark" size={18} color="#fff" />
            ) : (
              <Ionicons name="add" size={18} color="#fff" />
            )}
            <Text variant="body" style={styles.addButtonText}>
              {addArtist.isSuccess ? "Added" : "Add to Library"}
            </Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 12,
    paddingBottom: 4,
  },
  optionsSection: {
    paddingHorizontal: 16,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionMeta: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontFamily: Fonts.medium,
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addButtonText: {
    color: "#fff",
    fontFamily: Fonts.semiBold,
  },
});
