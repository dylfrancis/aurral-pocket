import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
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
import { useColors } from "@/hooks/use-colors";
import {
  useSectionLayoutDraft,
  type LayoutSection,
  type SectionLayoutEditorProps,
} from "./section-layout";

/**
 * A page's sections as switches in a list held and dragged to reorder, with
 * Save and Reset to Default. iOS has a SwiftUI list of its own.
 */
export function SectionLayoutEditor<Section extends LayoutSection>({
  sections,
  defaults,
  onSave,
  scope,
}: SectionLayoutEditorProps<Section>) {
  const colors = useColors();
  const { shown, isSaving, toggle, reorder, reset, save } =
    useSectionLayoutDraft({ sections, defaults, onSave });

  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      reorder((current) => reorderItems(current, from, to));
    },
    [reorder],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Section>) => (
      <Row
        section={item}
        onToggle={toggle}
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
      toggle,
    ],
  );

  return (
    <ReorderableList
      data={shown}
      onReorder={handleReorder}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <Text
          variant="caption"
          style={[styles.intro, { color: colors.subtle }]}
        >
          {scope ? `${scope} ` : ""}Toggle sections on or off. Hold and drag a
          row to reorder.
        </Text>
      }
      ListFooterComponent={
        <View style={styles.footer}>
          <Button title="Save" onPress={save} loading={isSaving} />
          <Button title="Reset to Default" variant="inline" onPress={reset} />
        </View>
      }
    />
  );
}

const keyExtractor = (section: LayoutSection) => section.id;

type RowProps = {
  section: LayoutSection;
  onToggle: (id: string) => void;
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
        style={[styles.rowLabel, { color: textColor, ...Fonts.medium }]}
      >
        {section.label}
      </Text>
      {/* Keying on `enabled` remounts the Switch on toggle: React Native's
          Switch can lose its visual state on a re-render. */}
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  intro: {
    paddingTop: 8,
    paddingBottom: 8,
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
    paddingTop: 20,
  },
});
