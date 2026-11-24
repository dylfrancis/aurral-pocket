import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { IS_IOS } from "@/constants/platform";
import { Fonts } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import React, { memo, useCallback, useState } from "react";
import {
  Alert,
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
import { useColors } from "@/hooks/use-colors";

/** A page section the reader can turn off or move. */
export type LayoutSection = { id: string; label: string; enabled: boolean };

type EditorProps<Section extends LayoutSection> = {
  sections: Section[];
  /** What Reset to Default puts back. */
  defaults: readonly Section[];
  onSave: (next: Section[]) => Promise<void>;
  /** A sentence before the how-to, saying where the layout applies. */
  scope?: string;
};

/**
 * A page's sections as switches in a list held and dragged to reorder, with
 * Save and Reset to Default. Nothing changes until Save.
 */
export function SectionLayoutEditor<Section extends LayoutSection>({
  sections,
  defaults,
  onSave,
  scope,
}: EditorProps<Section>) {
  const colors = useColors();
  const router = useRouter();
  // The list starts under iOS's transparent header and runs under the tab
  // bar. They're padding, not automatic insets: a drag turns scrolling off,
  // which puts the offset back at 0 and would shift the rows up under the
  // header.
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const overlap = IS_IOS
    ? { top: headerHeight, bottom: insets.bottom }
    : { top: 0, bottom: 0 };
  // Null until the first change, so a layout that arrives after the page
  // opens, such as the server's, still shows.
  const [draft, setDraft] = useState<Section[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const shown = draft ?? sections;

  const handleReset = useCallback(() => {
    setDraft(defaults.map((section) => ({ ...section })));
  }, [defaults]);

  const handleToggle = useCallback(
    (id: string) => {
      setDraft((prev) =>
        (prev ?? sections).map((section) =>
          section.id === id
            ? { ...section, enabled: !section.enabled }
            : section,
        ),
      );
    },
    [sections],
  );

  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      setDraft((prev) => reorderItems(prev ?? sections, from, to));
    },
    [sections],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(shown);
      router.back();
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Please try again.";
      Alert.alert("Could not save layout", message);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, router, shown]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Section>) => (
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
    <ReorderableList
      data={shown}
      onReorder={handleReorder}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentInsetAdjustmentBehavior="never"
      autoscrollThresholdOffset={overlap}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.listContent,
        { paddingTop: overlap.top, paddingBottom: overlap.bottom + 24 },
      ]}
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
          <Button title="Save" onPress={handleSave} loading={isSaving} />
          <Button
            title="Reset to Default"
            variant="inline"
            onPress={handleReset}
          />
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
