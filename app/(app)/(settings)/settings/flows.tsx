import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { EmptyState } from "@/components/library/EmptyState";
import { MenuPicker } from "@/components/ui/MenuPicker";
import { useUpdateWorkerSettings, useWorkerSettings } from "@/hooks/flow";
import { Fonts } from "@/constants/theme";
import { WorkerSettings } from "@/lib/types/flow";
import { useColors } from "@/hooks/use-colors";

const CONCURRENCY_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
];

export default function WorkerSettingsScreen() {
  const colors = useColors();
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
        <MenuPicker
          accessibilityLabel="Concurrency"
          value={String(data.concurrency)}
          options={CONCURRENCY_OPTIONS}
          onChange={(value) =>
            apply({
              concurrency: Number(value) as WorkerSettings["concurrency"],
            })
          }
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
  const colors = useColors();

  return (
    <Card bordered style={styles.section}>
      <View style={styles.sectionHead}>
        <Text
          variant="subtitle"
          style={[
            styles.sectionTitle,
            { color: colors.text, ...Fonts.semiBold },
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
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHead: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
});
