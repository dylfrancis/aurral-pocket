import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MonitoringRulesFields } from "@/components/artist/MonitoringRulesFields";
import { AppSheetScrollView } from "@/components/ui/AppSheet";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import {
  describeMonitoringRules,
  monitoringRulesProblem,
  type MonitoringChoice,
} from "@/lib/monitoring-rules";
import type { ArtistMonitoring, MonitoringRules } from "@/lib/types/monitoring";

type MonitoringFormProps = {
  title: string;
  artistName: string;
  /** Undefined until the server's defaults have loaded. */
  defaultRules: MonitoringRules | undefined;
  defaultsFailed?: boolean;
  initialChoice: MonitoringChoice;
  /** The artist's own rules, which Custom Rules starts from. Else the defaults. */
  initialRules?: MonitoringRules | null;
  offDescription: string;
  submitLabel: string;
  submitIcon: keyof typeof Ionicons.glyphMap;
  submitting: boolean;
  submitted?: boolean;
  submittedLabel?: string;
  onSubmit: (monitoring: ArtistMonitoring) => void;
};

/** Mounted inside the sheet, so each opening starts over from the props. */
export function MonitoringForm({
  title,
  artistName,
  defaultRules,
  defaultsFailed,
  initialChoice,
  initialRules,
  offDescription,
  submitLabel,
  submitIcon,
  submitting,
  submitted,
  submittedLabel,
  onSubmit,
}: MonitoringFormProps) {
  const colors = useColors();
  const [choice, setChoice] = useState(initialChoice);
  const [customRules, setCustomRules] = useState(initialRules ?? null);
  const rules = customRules ?? defaultRules;

  const choices: {
    value: MonitoringChoice;
    label: string;
    description: string;
  }[] = [
    {
      value: "default",
      label: "Default Rules",
      description: defaultRules
        ? describeMonitoringRules(defaultRules)
        : defaultsFailed
          ? "Downloads what the defaults in Settings pick"
          : "Loading the default rules…",
    },
    {
      value: "custom",
      label: "Custom Rules",
      description: "Your own rules for this artist",
    },
    { value: "off", label: "Not Monitored", description: offDescription },
  ];

  const request: ArtistMonitoring | null =
    choice === "off"
      ? { monitored: false }
      : choice === "default"
        ? { monitored: true, useDefault: true }
        : rules
          ? { monitored: true, useDefault: false, rules }
          : null;
  const problem =
    choice === "custom" && rules ? monitoringRulesProblem(rules) : null;
  const canSubmit = !!request && !problem && !submitting;

  return (
    <AppSheetScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text variant="title" style={styles.title}>
          {title}
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
          Monitoring
        </Text>
        {choices.map((option) => {
          const isSelected = choice === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => setChoice(option.value)}
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

      {choice === "custom" ? (
        rules ? (
          <MonitoringRulesFields rules={rules} onChange={setCustomRules} />
        ) : (
          <View style={styles.rulesStatus}>
            {defaultsFailed ? (
              <Text variant="caption" style={{ color: colors.error }}>
                Couldn&apos;t load the default rules to start from.
              </Text>
            ) : (
              <ActivityIndicator color={colors.subtle} />
            )}
          </View>
        )
      ) : null}

      <View style={styles.actions}>
        {problem ? (
          <Text
            variant="caption"
            style={[styles.problem, { color: colors.error }]}
          >
            {problem}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: colors.brand,
              opacity: !canSubmit && !submitting ? 0.5 : pressed ? 0.8 : 1,
            },
          ]}
          onPress={() => {
            if (canSubmit && request) onSubmit(request);
          }}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator size={18} color={colors.buttonPrimaryText} />
          ) : (
            <Ionicons
              name={submitted ? "checkmark" : submitIcon}
              size={18}
              color={colors.buttonPrimaryText}
            />
          )}
          <Text
            variant="body"
            style={[styles.submitText, { color: colors.buttonPrimaryText }]}
          >
            {submitted && submittedLabel ? submittedLabel : submitLabel}
          </Text>
        </Pressable>
      </View>
    </AppSheetScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 4,
  },
  title: {
    fontSize: 20,
    ...Fonts.bold,
  },
  sectionLabel: {
    ...Fonts.semiBold,
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
    ...Fonts.medium,
  },
  rulesStatus: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  problem: {
    textAlign: "center",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  submitText: {
    ...Fonts.semiBold,
  },
});
