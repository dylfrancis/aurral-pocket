import { Button } from "@/components/ui/Button";
import { CloseButton } from "@/components/ui/CloseButton";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { DEFAULT_DISCOVER_SECTIONS } from "@/hooks/discover/use-discover-layout";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { DiscoverSection } from "@/lib/types/me";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { AppSheet } from "@/components/ui/AppSheet";
import React, { memo, useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  View,
  type ListRenderItemInfo,
} from "react-native";
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  sections: DiscoverSection[];
  onSave: (next: DiscoverSection[]) => Promise<void> | void;
  onSaveError?: (error: unknown) => void;
};

export function CustomizeDiscoverSheet({
  sheetRef,
  sections,
  onSave,
  onSaveError,
}: Props) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<DiscoverSection[]>(sections);
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = useCallback(() => {
    sheetRef.current?.dismiss();
  }, [sheetRef]);

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_DISCOVER_SECTIONS.map((section) => ({ ...section })));
  }, []);

  const handleToggle = useCallback((id: DiscoverSection["id"]) => {
    setDraft((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, enabled: !section.enabled } : section,
      ),
    );
  }, []);

  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      setDraft((prev) => reorderItems(prev, from, to));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
      sheetRef.current?.dismiss();
    } catch (err) {
      onSaveError?.(err);
    } finally {
      setIsSaving(false);
    }
  }, [draft, onSave, onSaveError, sheetRef]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<DiscoverSection>) => (
      <Row
        section={item}
        onToggle={handleToggle}
        textColor={colors.text}
        subtleColor={colors.subtle}
        separatorColor={colors.separator}
        switchTrackOff={colors.separator}
        switchTrackOn={colors.brand}
        switchThumb={colors.switchThumb}
      />
    ),
    [
      colors.brand,
      colors.separator,
      colors.subtle,
      colors.switchThumb,
      colors.text,
      handleToggle,
    ],
  );

  return (
    <AppSheet
      ref={sheetRef}
      snapPoints={["85%"]}
      backdropPressBehavior="none"
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      enableHandlePanningGesture={false}
      enableContentPanningGesture={false}
      onChange={(index) => {
        if (index >= 0) {
          setDraft(sections.map((section) => ({ ...section })));
          setIsSaving(false);
        }
      }}
    >
      <BottomSheetView style={styles.container}>
        <View style={[styles.header, { borderColor: colors.separator }]}>
          <View style={styles.headerText}>
            <Text
              variant="title"
              style={[
                styles.title,
                { color: colors.text, fontFamily: Fonts.bold },
              ]}
            >
              Customize Discover
            </Text>
            <Text variant="caption" style={{ color: colors.subtle }}>
              Toggle sections on or off. Hold and drag a row to reorder.
            </Text>
          </View>
          <CloseButton
            onPress={handleClose}
            fallbackBackground={colors.inputBackground}
          />
        </View>

        <ReorderableList
          data={draft}
          onReorder={handleReorder}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />

        <View
          style={[
            styles.footer,
            {
              borderColor: colors.separator,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <Button title="Save" onPress={handleSave} loading={isSaving} />
          <Button
            title="Reset to Default"
            variant="inline"
            onPress={handleReset}
          />
        </View>
      </BottomSheetView>
    </AppSheet>
  );
}

const keyExtractor = (section: DiscoverSection) => section.id;

type RowProps = {
  section: DiscoverSection;
  onToggle: (id: DiscoverSection["id"]) => void;
  textColor: string;
  subtleColor: string;
  separatorColor: string;
  switchTrackOff: string;
  switchTrackOn: string;
  switchThumb: string;
};

const Row = memo(function Row({
  section,
  onToggle,
  textColor,
  subtleColor,
  separatorColor,
  switchTrackOff,
  switchTrackOn,
  switchThumb,
}: RowProps) {
  const drag = useReorderableDrag();

  return (
    <Pressable
      onLongPress={drag}
      delayLongPress={200}
      style={[styles.row, { borderColor: separatorColor }]}
      accessibilityLabel={`${section.label}, ${section.enabled ? "enabled" : "disabled"}`}
    >
      <Ionicons name="reorder-three" size={22} color={subtleColor} />
      <Text
        variant="body"
        style={[
          styles.rowLabel,
          { color: textColor, fontFamily: Fonts.medium },
        ]}
      >
        {section.label}
      </Text>
      {/* Keying on `enabled` remounts the Switch on toggle, working around
          facebook/react-native#53856 where it can lose its visual state on
          re-render — see also FlowDetailSheet for the same pattern. */}
      <Switch
        key={`section-${section.id}-${section.enabled}`}
        value={section.enabled}
        onValueChange={() => onToggle(section.id)}
        trackColor={{ false: switchTrackOff, true: switchTrackOn }}
        thumbColor={switchThumb}
        ios_backgroundColor={switchTrackOff}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
  },
  listContent: {
    paddingVertical: 4,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
  },
  footer: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
