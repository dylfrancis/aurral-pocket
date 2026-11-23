import { useState, type ReactNode } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Host } from "@expo/ui";
import { SettingsSwitch } from "@/components/settings/SettingsSwitch";
import { MenuPicker } from "@/components/ui/MenuPicker";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { PillRow } from "@/components/ui/PillRow";
import { inputThemedStyle } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { Fonts, Radius } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  CATALOG_HINTS,
  CATALOG_OPTIONS,
  EDITION_HINTS,
  EDITION_OPTIONS,
  EXTRA_TYPE_OPTIONS,
  FIRST_SINCE_YEAR,
  MAX_LATEST_RELEASES,
  MAX_TOP_TRACKS,
  RELEASE_TYPE_OPTIONS,
  lastSinceYear,
  toggleType,
  withCatalog,
} from "@/lib/monitoring-rules";
import type { MonitoringRules } from "@/lib/types/monitoring";

const RELEASE_TYPE_PILLS = RELEASE_TYPE_OPTIONS.map(({ value, label }) => ({
  id: value,
  label,
}));
const EXTRA_TYPE_PILLS = EXTRA_TYPE_OPTIONS.map(({ value, label }) => ({
  id: value,
  label,
}));

type MonitoringRulesFieldsProps = {
  rules: MonitoringRules;
  onChange: (rules: MonitoringRules) => void;
};

export function MonitoringRulesFields({
  rules,
  onChange,
}: MonitoringRulesFieldsProps) {
  const update = (patch: Partial<MonitoringRules>) =>
    onChange({ ...rules, ...patch });

  return (
    <View style={styles.fields}>
      <FieldRow label="Back Catalogue">
        <MenuPicker
          accessibilityLabel="Back Catalogue"
          value={rules.catalog}
          options={CATALOG_OPTIONS}
          onChange={(catalog) => onChange(withCatalog(rules, catalog))}
        />
      </FieldRow>
      {rules.catalog === "since" ? (
        <FieldRow label="First Year">
          <YearField
            value={rules.sinceYear}
            onChange={(sinceYear) => update({ sinceYear })}
          />
        </FieldRow>
      ) : null}
      {rules.catalog === "latest" ? (
        <FieldRow label="Releases">
          <CountStepper
            label="Releases"
            value={rules.latestCount}
            min={1}
            max={MAX_LATEST_RELEASES}
            onChange={(latestCount) => update({ latestCount })}
          />
        </FieldRow>
      ) : null}
      <Hint>{CATALOG_HINTS[rules.catalog]}</Hint>

      <FieldRow label="New Releases">
        <Host matchContents ignoreSafeArea="all">
          <SettingsSwitch
            value={rules.newReleases}
            accessibilityLabel="New Releases"
            onChange={(newReleases) => update({ newReleases })}
          />
        </Host>
      </FieldRow>
      <Hint>Download matching releases when they come out.</Hint>

      <Label>Release Types</Label>
      <PillRow
        items={RELEASE_TYPE_PILLS}
        selected={rules.types}
        onSelect={(type) => onChange(toggleType(rules, "types", type))}
      />
      <Label>Also Include</Label>
      <PillRow
        items={EXTRA_TYPE_PILLS}
        selected={rules.extraTypes}
        onSelect={(type) => onChange(toggleType(rules, "extraTypes", type))}
      />

      <FieldRow label="Edition">
        <MenuPicker
          accessibilityLabel="Edition"
          value={rules.edition}
          options={EDITION_OPTIONS}
          onChange={(edition) => update({ edition })}
        />
      </FieldRow>
      <Hint>{EDITION_HINTS[rules.edition]}</Hint>

      <FieldRow label="Top Tracks">
        <CountStepper
          label="Top Tracks"
          value={rules.topTracks}
          min={0}
          max={MAX_TOP_TRACKS}
          onChange={(topTracks) => update({ topTracks })}
        />
      </FieldRow>
      <Hint>Popular songs missing from these releases.</Hint>
    </View>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="body" style={styles.rowLabel}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text
      variant="caption"
      style={[styles.sectionLabel, { color: colors.subtle }]}
    >
      {children}
    </Text>
  );
}

function Hint({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text variant="caption" style={[styles.hint, { color: colors.subtle }]}>
      {children}
    </Text>
  );
}

function CountStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text variant="body" style={styles.count}>
        {String(value)}
      </Text>
      <NumberStepper
        accessibilityLabel={label}
        value={value}
        min={min}
        max={max}
        onChange={onChange}
      />
    </View>
  );
}

/**
 * Save doesn't blur the field, so each keystroke goes to the rules, brought
 * into the server's range.
 */
function YearField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (year: number) => void;
}) {
  const scheme = useColorScheme();
  const colors = useColors();
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <TextInput
      accessibilityLabel="First Year"
      value={draft ?? (value == null ? "" : String(value))}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, "").slice(0, 4);
        setDraft(digits);
        if (digits) {
          const year = Number(digits);
          onChange(Math.min(lastSinceYear(), Math.max(FIRST_SINCE_YEAR, year)));
        }
      }}
      onEndEditing={() => setDraft(null)}
      keyboardType="number-pad"
      returnKeyType="done"
      maxLength={4}
      style={[
        inputThemedStyle(scheme),
        styles.year,
        // The input background is the sheet's own color, so the field would vanish.
        { backgroundColor: colors.tagFill },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  fields: {
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  rowLabel: {
    ...Fonts.medium,
    flexShrink: 1,
  },
  sectionLabel: {
    ...Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  hint: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  count: {
    ...Fonts.semiBold,
    minWidth: 24,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  year: {
    width: 84,
    height: 40,
    borderRadius: Radius.compact,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
});
