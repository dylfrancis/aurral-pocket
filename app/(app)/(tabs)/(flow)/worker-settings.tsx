import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { EmptyState } from "@/components/library/EmptyState";
import { SegmentedRow } from "@/components/flow/SegmentedRow";
import { useUpdateWorkerSettings, useWorkerSettings } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { WorkerSettings } from "@/lib/types/flow";

const CONCURRENCY_OPTIONS = [
  { value: 1 as const, label: "1" },
  { value: 2 as const, label: "2" },
  { value: 3 as const, label: "3" },
];

const EXISTING_FILE_MODE_OPTIONS = [
  { value: "reuse" as const, label: "Reuse" },
  { value: "download" as const, label: "Download" },
];

export default function WorkerSettingsScreen() {
  const colors = Colors[useColorScheme()];
  const { data } = useWorkerSettings();
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
        title="Existing Files"
        subtitle="Reuse tracks already in Aurral or Lidarr before downloading new copies."
      >
        <SegmentedRow
          value={data.existingFileMode}
          options={EXISTING_FILE_MODE_OPTIONS}
          onChange={(existingFileMode) => apply({ existingFileMode })}
        />
      </Section>
    </ScrollView>
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ScreenCenter>
      <EmptyState
        icon="cloud-offline-outline"
        message="Failed to load worker settings"
        actionLabel="Try Again"
        onAction={() => {
          reset();
          retry();
        }}
      />
    </ScreenCenter>
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
    <Card bordered style={styles.section}>
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
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  section: {
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
});
