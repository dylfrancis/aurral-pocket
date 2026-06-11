import { useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MixSlider } from "@/components/flow/MixSlider";
import { MixPresetPicker } from "@/components/flow/MixPresetPicker";
import { SizeStepper } from "@/components/flow/SizeStepper";
import { ScheduleDayPicker } from "@/components/flow/ScheduleDayPicker";
import { ScheduleHourPicker } from "@/components/flow/ScheduleHourPicker";
import { FocusEditor } from "@/components/flow/FocusEditor";
import { useCreateFlow, useFlow, useUpdateFlow } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { createDefaultFlowForm, type FlowFormValues } from "@/lib/types/flow";
import { flowFormSchema, type FlowFormSchema } from "@/lib/flow-form-schema";

export default function FlowEditScreen() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof params.id === "string" ? params.id : null;
  const existingFlow = useFlow(editingId ?? undefined);

  const createFlow = useCreateFlow();
  const updateFlow = useUpdateFlow();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FlowFormSchema>({
    resolver: zodResolver(flowFormSchema),
    defaultValues: createDefaultFlowForm(),
  });

  useEffect(() => {
    if (!editingId || !existingFlow) return;
    reset({
      name: existingFlow.name,
      size: existingFlow.size,
      mix: { ...existingFlow.mix, focus: existingFlow.mix.focus ?? 0 },
      deepDive: existingFlow.deepDive,
      tags: [...(existingFlow.tags ?? [])],
      relatedArtists: [...(existingFlow.relatedArtists ?? [])],
      scheduleDays: [...(existingFlow.scheduleDays ?? [])],
      scheduleTime: existingFlow.scheduleTime || "00:00",
    });
  }, [editingId, existingFlow, reset]);

  const [watchedTags, watchedArtists, watchedMix] = useWatch({
    control,
    name: ["tags", "relatedArtists", "mix"],
  });
  const hasFocusEntries =
    (watchedTags?.length ?? 0) > 0 || (watchedArtists?.length ?? 0) > 0;
  const focusInactive = hasFocusEntries && (watchedMix?.focus ?? 0) === 0;

  const isPending = createFlow.isPending || updateFlow.isPending;

  const onSubmit = (values: FlowFormSchema) => {
    const payload: FlowFormValues = values;
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
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Discover"
                autoCapitalize="words"
              />
            )}
          />
          {errors.name?.message ? (
            <Text variant="caption" style={{ color: colors.error }}>
              {errors.name.message}
            </Text>
          ) : null}
        </Section>

        <Section
          title="Mix"
          subtitle="How tracks are sourced. The three values always total 100%."
        >
          <Controller
            control={control}
            name="mix"
            render={({ field: { value, onChange } }) => (
              <>
                <MixPresetPicker value={value} onPick={onChange} />
                <View style={{ height: 12 }} />
                <MixSlider value={value} onChange={onChange} />
                {errors.mix?.message ? (
                  <Text
                    variant="caption"
                    style={{ color: colors.error, marginTop: 6 }}
                  >
                    {errors.mix.message}
                  </Text>
                ) : null}
              </>
            )}
          />
        </Section>

        <Section title="Size" subtitle="Number of tracks per refresh.">
          <Controller
            control={control}
            name="size"
            render={({ field: { value, onChange } }) => (
              <SizeStepper value={value} onChange={onChange} />
            )}
          />
        </Section>

        <Controller
          control={control}
          name="deepDive"
          render={({ field: { value, onChange } }) => (
            <Section
              title="Deep Dive"
              subtitle="Surface lesser-known tracks from each artist."
              trailing={
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ false: colors.separator, true: colors.brand }}
                  thumbColor={colors.switchThumb}
                  ios_backgroundColor={colors.separator}
                />
              }
            />
          )}
        />

        <Section
          title="Focus"
          subtitle="Bias the flow toward specific tags or artists."
        >
          <Controller
            control={control}
            name="tags"
            render={({ field: { value, onChange } }) => (
              <FocusEditor
                label="Tags"
                placeholder="Add a tag (e.g. ambient)"
                value={value}
                onChange={onChange}
              />
            )}
          />
          <View style={{ height: 16 }} />
          <Controller
            control={control}
            name="relatedArtists"
            render={({ field: { value, onChange } }) => (
              <FocusEditor
                label="Related artists"
                placeholder="Add an artist name"
                value={value}
                onChange={onChange}
              />
            )}
          />
          {focusInactive ? (
            <Text variant="caption" style={{ color: colors.subtle }}>
              Set Focus above 0% in the mix for these to take effect.
            </Text>
          ) : null}
          {errors.tags?.message ? (
            <Text variant="caption" style={{ color: colors.error }}>
              {errors.tags.message}
            </Text>
          ) : null}
        </Section>

        <Section title="Schedule" subtitle="Pick the days this flow refreshes.">
          <Controller
            control={control}
            name="scheduleDays"
            render={({ field: { value, onChange } }) => (
              <ScheduleDayPicker value={value} onChange={onChange} />
            )}
          />
          {errors.scheduleDays?.message ? (
            <Text variant="caption" style={{ color: colors.error }}>
              {errors.scheduleDays.message}
            </Text>
          ) : null}
          <Controller
            control={control}
            name="scheduleTime"
            render={({ field: { value, onChange } }) => (
              <ScheduleHourPicker value={value} onChange={onChange} />
            )}
          />
        </Section>

        <View style={{ paddingTop: 8 }}>
          <Button
            title={editingId ? "Save Changes" : "Create Flow"}
            onPress={handleSubmit(onSubmit)}
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
    <Card bordered style={styles.section}>
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
});
