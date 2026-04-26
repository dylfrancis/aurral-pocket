import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { SegmentedRow } from "@/components/flow/SegmentedRow";
import { useUpdateWorkerSettings, useWorkerSettings } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { RETRY_CYCLE_OPTIONS_MINUTES, WorkerSettings } from "@/lib/types/flow";

const CONCURRENCY_OPTIONS = [
  { value: 1 as const, label: "1" },
  { value: 2 as const, label: "2" },
  { value: 3 as const, label: "3" },
];

const FORMAT_OPTIONS = [
  { value: "flac" as const, label: "FLAC" },
  { value: "mp3" as const, label: "MP3" },
];

const RETRY_LABELS: Record<number, string> = {
  15: "15 min",
  30: "30 min",
  60: "1 hr",
  360: "6 hr",
  720: "12 hr",
  1440: "24 hr",
};

const RETRY_OPTIONS = RETRY_CYCLE_OPTIONS_MINUTES.map((minutes) => ({
  value: minutes,
  label: RETRY_LABELS[minutes] ?? `${minutes} min`,
}));

export default function WorkerSettingsScreen() {
  const colors = Colors[useColorScheme()];
  const { data, isLoading } = useWorkerSettings();
  const update = useUpdateWorkerSettings();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const apply = (next: Partial<WorkerSettings>) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      update.mutate(next);
    }, 300);
  };

  if (isLoading || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { backgroundColor: colors.background },
      ]}
    >
      <Section
        title="Concurrency"
        subtitle="Number of tracks downloaded in parallel."
      >
        <SegmentedRow
          value={data.concurrency}
          options={CONCURRENCY_OPTIONS}
          onChange={(concurrency) => apply({ concurrency })}
        />
      </Section>

      <Section
        title="Preferred Format"
        subtitle="Try this format first when matching candidates."
      >
        <SegmentedRow
          value={data.preferredFormat}
          options={FORMAT_OPTIONS}
          onChange={(preferredFormat) => apply({ preferredFormat })}
        />
        <View style={[styles.toggleRow, { borderColor: colors.separator }]}>
          <View style={{ flex: 1 }}>
            <Text variant="body" style={{ fontFamily: Fonts.medium }}>
              Strict
            </Text>
            <Text variant="caption">
              Skip non-matching candidates instead of falling back.
            </Text>
          </View>
          <Switch
            value={data.preferredFormatStrict}
            onValueChange={(preferredFormatStrict) =>
              apply({ preferredFormatStrict })
            }
            trackColor={{ false: colors.separator, true: colors.brand }}
            thumbColor={colors.surfaceElevated}
            ios_backgroundColor={colors.separator}
          />
        </View>
      </Section>

      <Section
        title="Retry Cycle"
        subtitle="How often the worker retries incomplete playlists."
      >
        <SegmentedRow
          value={data.retryCycleMinutes}
          options={RETRY_OPTIONS}
          onChange={(retryCycleMinutes) => apply({ retryCycleMinutes })}
        />
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const colors = Colors[useColorScheme()];

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.card, borderColor: colors.separator },
      ]}
    >
      <View style={styles.sectionHead}>
        <Text
          variant="subtitle"
          style={[
            styles.sectionTitle,
            { color: colors.text, fontFamily: Fonts.semiBold },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" style={{ color: colors.subtle }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  section: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  sectionHead: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  toggleRow: {
    height: 60,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
