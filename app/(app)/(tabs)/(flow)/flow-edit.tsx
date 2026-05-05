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
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  DEFAULT_FLOW_FORM,
  FLOW_SIZE_MAX,
  FLOW_SIZE_MIN,
  type FlowFormValues,
} from "@/lib/types/flow";

const focusStrength = z.enum(["light", "medium", "heavy"]);

const flowFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  size: z.number().int().min(FLOW_SIZE_MIN).max(FLOW_SIZE_MAX),
  mix: z
    .object({
      discover: z.number().min(0).max(100),
      mix: z.number().min(0).max(100),
      trending: z.number().min(0).max(100),
    })
    .refine((m) => Math.round(m.discover + m.mix + m.trending) === 100, {
      message: "Mix must total 100%",
    }),
  deepDive: z.boolean(),
  tags: z.record(z.string(), focusStrength),
  relatedArtists: z.record(z.string(), focusStrength),
  scheduleDays: z.array(z.number().int().min(0).max(6)),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
});

type FlowFormSchema = z.infer<typeof flowFormSchema>;

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
    defaultValues: DEFAULT_FLOW_FORM,
  });

  useEffect(() => {
    if (!editingId || !existingFlow) return;
    reset({
      name: existingFlow.name,
      size: existingFlow.size,
      mix: { ...existingFlow.mix },
      deepDive: existingFlow.deepDive,
      tags: { ...(existingFlow.tags ?? {}) },
      relatedArtists: { ...(existingFlow.relatedArtists ?? {}) },
      scheduleDays: [...(existingFlow.scheduleDays ?? [])],
      scheduleTime: existingFlow.scheduleTime || "00:00",
    });
  }, [editingId, existingFlow, reset]);

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
        </Section>

        <Section
          title="Schedule"
          subtitle="Pick refresh days. Leave empty for manual-only runs."
        >
          <Controller
            control={control}
            name="scheduleDays"
            render={({ field: { value, onChange } }) => (
              <ScheduleDayPicker value={value} onChange={onChange} />
            )}
          />
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
});
