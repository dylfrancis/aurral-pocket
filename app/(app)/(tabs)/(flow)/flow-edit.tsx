import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { MixSlider } from "@/components/flow/MixSlider";
import { MixPresetPicker } from "@/components/flow/MixPresetPicker";
import { SizeStepper } from "@/components/flow/SizeStepper";
import { ScheduleDayPicker } from "@/components/flow/ScheduleDayPicker";
import { ScheduleHourPicker } from "@/components/flow/ScheduleHourPicker";
import { FocusEditor } from "@/components/flow/FocusEditor";
import { useCreateFlow, useFlow, useUpdateFlow } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { DEFAULT_FLOW_FORM, FlowFormValues } from "@/lib/types/flow";

function clone(values: FlowFormValues): FlowFormValues {
  return {
    ...values,
    mix: { ...values.mix },
    tags: { ...values.tags },
    relatedArtists: { ...values.relatedArtists },
    scheduleDays: [...values.scheduleDays],
  };
}

export default function FlowEditScreen() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof params.id === "string" ? params.id : null;
  const existingFlow = useFlow(editingId ?? undefined);

  const createFlow = useCreateFlow();
  const updateFlow = useUpdateFlow();

  const [values, setValues] = useState<FlowFormValues>(() =>
    clone(DEFAULT_FLOW_FORM),
  );

  useEffect(() => {
    if (!editingId || !existingFlow) return;
    setValues({
      name: existingFlow.name,
      size: existingFlow.size,
      mix: { ...existingFlow.mix },
      deepDive: existingFlow.deepDive,
      tags: { ...(existingFlow.tags ?? {}) },
      relatedArtists: { ...(existingFlow.relatedArtists ?? {}) },
      scheduleDays: [...(existingFlow.scheduleDays ?? [])],
      scheduleTime: existingFlow.scheduleTime || "00:00",
    });
  }, [editingId, existingFlow]);

  const isPending = createFlow.isPending || updateFlow.isPending;

  const handleSave = () => {
    const trimmedName = values.name.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Give your flow a name before saving.");
      return;
    }
    const payload: FlowFormValues = { ...values, name: trimmedName };

    if (editingId) {
      updateFlow.mutate(
        { flowId: editingId, payload },
        {
          onSuccess: () => router.back(),
          onError: (err: any) =>
            Alert.alert("Could not save", err?.message ?? "Try again."),
        },
      );
    } else {
      createFlow.mutate(payload, {
        onSuccess: () => router.back(),
        onError: (err: any) =>
          Alert.alert("Could not create", err?.message ?? "Try again."),
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <Stack.Screen
        options={{
          title: editingId ? "Edit Flow" : "New Flow",
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={isPending}
              style={({ pressed }) => [
                styles.headerButton,
                { opacity: pressed || isPending ? 0.5 : 1 },
              ]}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text
                  variant="body"
                  style={{ color: colors.text, fontFamily: Fonts.semiBold }}
                >
                  Save
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { backgroundColor: colors.background },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Name">
          <Input
            value={values.name}
            onChangeText={(name) => setValues((v) => ({ ...v, name }))}
            placeholder="Discover"
            autoCapitalize="words"
          />
        </Section>

        <Section
          title="Mix"
          subtitle="How tracks are sourced. The three values always total 100%."
        >
          <MixPresetPicker
            value={values.mix}
            onPick={(mix) => setValues((v) => ({ ...v, mix }))}
          />
          <View style={{ height: 12 }} />
          <MixSlider
            value={values.mix}
            onChange={(mix) => setValues((v) => ({ ...v, mix }))}
          />
        </Section>

        <Section title="Size" subtitle="Number of tracks per refresh.">
          <SizeStepper
            value={values.size}
            onChange={(size) => setValues((v) => ({ ...v, size }))}
          />
        </Section>

        <Section
          title="Deep Dive"
          subtitle="Surface lesser-known tracks from each artist."
          trailing={
            <Switch
              value={values.deepDive}
              onValueChange={(deepDive) =>
                setValues((v) => ({ ...v, deepDive }))
              }
              trackColor={{ false: colors.separator, true: colors.brand }}
              thumbColor={colors.surfaceElevated}
              ios_backgroundColor={colors.separator}
            />
          }
        />

        <Section
          title="Focus"
          subtitle="Bias the flow toward specific tags or artists."
        >
          <FocusEditor
            label="Tags"
            placeholder="Add a tag (e.g. ambient)"
            value={values.tags}
            onChange={(tags) => setValues((v) => ({ ...v, tags }))}
          />
          <View style={{ height: 16 }} />
          <FocusEditor
            label="Related artists"
            placeholder="Add an artist name"
            value={values.relatedArtists}
            onChange={(relatedArtists) =>
              setValues((v) => ({ ...v, relatedArtists }))
            }
          />
        </Section>

        <Section
          title="Schedule"
          subtitle="Pick refresh days. Leave empty for manual-only runs."
        >
          <ScheduleDayPicker
            value={values.scheduleDays}
            onChange={(scheduleDays) =>
              setValues((v) => ({ ...v, scheduleDays }))
            }
          />
          <View style={{ height: 16 }} />
          <Text
            variant="caption"
            style={[styles.subLabel, { color: colors.subtle }]}
          >
            Refresh hour
          </Text>
          <ScheduleHourPicker
            value={values.scheduleTime}
            onChange={(scheduleTime) =>
              setValues((v) => ({ ...v, scheduleTime }))
            }
          />
        </Section>

        <View style={{ paddingTop: 8 }}>
          <Button
            title={editingId ? "Save Changes" : "Create Flow"}
            onPress={handleSave}
            loading={isPending}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({
  title,
  subtitle,
  trailing,
  children,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
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
        <View style={styles.sectionTitleRow}>
          <Text
            variant="subtitle"
            style={[
              styles.sectionTitle,
              { color: colors.text, fontFamily: Fonts.semiBold },
            ]}
          >
            {title}
          </Text>
          {trailing ? <View>{trailing}</View> : null}
        </View>
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
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  subLabel: {
    fontFamily: Fonts.medium,
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
