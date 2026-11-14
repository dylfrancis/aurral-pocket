import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
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
import { YearBoundInput } from "@/components/flow/YearBoundInput";
import { useCreateFlow, useEditSnapshot, useUpdateFlow } from "@/hooks/flow";
import { useSignedInHealth } from "@/hooks/auth/use-signed-in-health";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import {
  createDefaultFlowForm,
  type Flow,
  type FlowFormValues,
} from "@/lib/types/flow";
import { flowFormSchema, type FlowFormSchema } from "@/lib/flow-form-schema";
import { Switch } from "@/components/ui/Switch";

function toFormValues(flow: Flow): FlowFormValues {
  return {
    name: flow.name,
    size: flow.size,
    mix: { ...flow.mix },
    deepDive: flow.deepDive,
    recentListening: flow.recentListening,
    // Match the server default (`recordHistory !== false`) so a flow from a
    // pre-2.5.0 server, which omits the field, seeds as enabled. Seeding false
    // here would send false back and turn the setting off.
    recordHistory: flow.recordHistory !== false,
    autoDownload: flow.autoDownload,
    yearFrom: flow.yearFrom ?? null,
    yearTo: flow.yearTo ?? null,
    tags: [...flow.tags],
    excludeTags: [...flow.excludeTags],
    relatedArtists: [...flow.relatedArtists],
    scheduleDays: [...flow.scheduleDays],
    scheduleTime: flow.scheduleTime || "00:00",
  };
}

function describeYearRange(
  yearFrom: number | null,
  yearTo: number | null,
): string {
  if (yearFrom != null && yearTo != null) {
    return yearFrom === yearTo
      ? `Only ${yearFrom} releases.`
      : `Releases from ${yearFrom} to ${yearTo}.`;
  }
  if (yearFrom != null) return `Releases from ${yearFrom} onward.`;
  if (yearTo != null) return `Releases up to ${yearTo}.`;
  return "Any release year.";
}

export default function FlowEditScreen() {
  const colors = Colors[useColorScheme()];
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof params.id === "string" ? params.id : null;

  // The form edits a one-time snapshot of the flow. Subscribing to the live
  // status poll here would re-render every tick, snapping the iOS hour wheel
  // back mid-gesture and resetting in-progress drafts (#138).
  const { snapshot: existingFlow, isLoading } = useEditSnapshot(
    !!editingId,
    (status) => status.flows.find((flow) => flow.id === editingId),
  );
  const health = useSignedInHealth();

  if (editingId ? isLoading : health.isLoading) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: colors.background }]}
      >
        <Stack.Screen options={{ title: "Edit Flow" }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (editingId && !existingFlow) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: colors.background }]}
      >
        <Stack.Screen options={{ title: "Edit Flow" }} />
        <Text variant="body">Flow not found.</Text>
      </View>
    );
  }

  const downloadSources = health.data?.downloadSources;
  return (
    <FlowEditForm
      editingId={editingId}
      existingFlow={existingFlow}
      // Aurral's default for a new flow. Without an answer, on is safe: a run
      // with no download source saves its picks anyway.
      newFlowAutoDownload={
        downloadSources
          ? Object.values(downloadSources).some((source) => source.configured)
          : true
      }
    />
  );
}

function FlowEditForm({
  editingId,
  existingFlow,
  newFlowAutoDownload,
}: {
  editingId: string | null;
  existingFlow: Flow | undefined;
  newFlowAutoDownload: boolean;
}) {
  const colors = Colors[useColorScheme()];
  const router = useRouter();

  const createFlow = useCreateFlow();
  const updateFlow = useUpdateFlow();

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FlowFormSchema>({
    resolver: zodResolver(flowFormSchema),
    defaultValues: existingFlow
      ? toFormValues(existingFlow)
      : createDefaultFlowForm(newFlowAutoDownload),
  });

  const [
    watchedArtists,
    watchedRecentListening,
    watchedMix,
    watchedYearFrom,
    watchedYearTo,
  ] = useWatch({
    control,
    name: ["relatedArtists", "recentListening", "mix", "yearFrom", "yearTo"],
  });
  // Tags filter every source, so they work without a Focus share.
  const hasFocusSeeds =
    (watchedArtists?.length ?? 0) > 0 || watchedRecentListening === true;
  const focusInactive = hasFocusSeeds && (watchedMix?.focus ?? 0) === 0;
  const yearError = errors.yearFrom?.message ?? errors.yearTo?.message;
  // After a submit the form re-checks only the changed field, so the fields
  // that feed the Focus check also re-check its error on relatedArtists.
  const focusSeedRules = { deps: "relatedArtists" as const };

  // The web marks a tag to leave out with a leading minus, as in -christmas.
  // Aurral ignores the minus when it matches tags, so kept in Tags the entry
  // would keep those artists instead.
  const onTagsChange = (next: string[], onChange: (tags: string[]) => void) => {
    const excluded = next
      .filter((tag) => tag.startsWith("-"))
      .map((tag) => tag.replace(/^-+/, "").trim())
      .filter(Boolean);
    if (excluded.length > 0) {
      const alreadyExcluded = getValues("excludeTags");
      setValue(
        "excludeTags",
        [
          ...alreadyExcluded,
          ...excluded.filter((tag) => !alreadyExcluded.includes(tag)),
        ],
        { shouldDirty: true },
      );
    }
    onChange(next.filter((tag) => !tag.startsWith("-")));
  };

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
      behavior={IS_IOS ? "padding" : undefined}
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
          subtitle="How tracks are sourced. The five sources always total 100%."
        >
          <Controller
            control={control}
            name="mix"
            rules={focusSeedRules}
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
              title="Deeper Cuts"
              subtitle="Use tracks ranked 10 to 25 instead of each artist's top 10."
              trailing={<Switch value={value} onValueChange={onChange} />}
            />
          )}
        />

        <Controller
          control={control}
          name="recordHistory"
          render={({ field: { value, onChange } }) => (
            <Section
              title="Record History"
              subtitle="Count plays from this flow in your listening history."
              trailing={<Switch value={value} onValueChange={onChange} />}
            />
          )}
        />

        <Controller
          control={control}
          name="autoDownload"
          render={({ field: { value, onChange } }) => (
            <Section
              title="Download Automatically"
              subtitle="Download new picks as soon as a run finds them. When off, they wait in the flow as previews until you download them."
              trailing={
                <Switch
                  value={value}
                  onValueChange={onChange}
                  accessibilityLabel="Download automatically"
                />
              }
            />
          )}
        />

        <Section
          title="Release Years"
          subtitle="Limit the flow to a range of release years. Leave a field empty to keep that end open."
        >
          <View style={styles.yearRow}>
            <Controller
              control={control}
              name="yearFrom"
              render={({ field: { value, onChange } }) => (
                <YearBoundInput
                  label="From"
                  placeholder="Any"
                  testID="year-from-input"
                  value={value}
                  onChange={onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="yearTo"
              render={({ field: { value, onChange } }) => (
                <YearBoundInput
                  label="To"
                  placeholder="Any"
                  testID="year-to-input"
                  value={value}
                  onChange={onChange}
                />
              )}
            />
          </View>
          <Text variant="caption" style={{ color: colors.subtle }}>
            {describeYearRange(watchedYearFrom ?? null, watchedYearTo ?? null)}
          </Text>
          {yearError ? (
            <Text variant="caption" style={{ color: colors.error }}>
              {yearError}
            </Text>
          ) : null}
        </Section>

        <Section
          title="Tags"
          subtitle="Limit every source to artists with at least one of these tags. Focus also searches by them."
        >
          <Controller
            control={control}
            name="tags"
            rules={focusSeedRules}
            render={({ field: { value, onChange } }) => (
              <FocusEditor
                label="Tags"
                placeholder="Add a tag (e.g. ambient)"
                value={value}
                onChange={(next) => onTagsChange(next, onChange)}
              />
            )}
          />
          <View style={{ height: 16 }} />
          <Controller
            control={control}
            name="excludeTags"
            render={({ field: { value, onChange } }) => (
              <FocusEditor
                label="Excluded tags"
                placeholder="Add a tag to leave out (e.g. christmas)"
                value={value}
                onChange={onChange}
              />
            )}
          />
        </Section>

        <Section
          title="Focus"
          subtitle="Find artists outside your library that are similar to ones you pick or to your recent listening."
        >
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
          <Controller
            control={control}
            name="recentListening"
            rules={focusSeedRules}
            render={({ field: { value, onChange } }) => (
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text variant="body" style={{ ...Fonts.medium }}>
                    Recent listening
                  </Text>
                  <Text variant="caption" style={{ color: colors.subtle }}>
                    Also find artists similar to the ones you played recently.
                  </Text>
                </View>
                <Switch
                  value={value}
                  onValueChange={onChange}
                  accessibilityLabel="Recent listening"
                />
              </View>
            )}
          />
          {focusInactive ? (
            <Text variant="caption" style={{ color: colors.subtle }}>
              Set Focus above 0% in the mix for these to take effect.
            </Text>
          ) : null}
          {errors.relatedArtists?.message ? (
            <Text variant="caption" style={{ color: colors.error }}>
              {errors.relatedArtists.message}
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
            onPress={() => handleSubmit(onSubmit)()}
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
              { color: colors.text, ...Fonts.semiBold },
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
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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
  yearRow: {
    flexDirection: "row",
    gap: 12,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    gap: 2,
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
