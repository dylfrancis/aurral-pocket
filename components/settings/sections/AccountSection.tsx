import { StyleSheet, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { SegmentedRow } from "@/components/flow/SegmentedRow";
import {
  useListeningHistory,
  useUpdateListeningHistory,
} from "@/hooks/me/use-listening-history";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { ListenHistoryProvider } from "@/lib/types/me";

type AccountForm = {
  provider: ListenHistoryProvider;
  username: string;
};

const providerOptions: { value: ListenHistoryProvider; label: string }[] = [
  { value: "local", label: "Local only" },
  { value: "lastfm", label: "Last.fm" },
  { value: "listenbrainz", label: "ListenBrainz" },
];

const HELPER_TEXT =
  "Choose where your listening history comes from. Local only uses the plays " +
  "Aurral records for you. Last.fm and ListenBrainz read an outside account.";

export function AccountSection() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { data, isPending, isError, refetch } = useListeningHistory();
  const updateMutation = useUpdateListeningHistory();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<AccountForm>({
    defaultValues: { provider: "lastfm", username: "" },
    values: data
      ? {
          provider: data.listenHistoryProvider ?? "lastfm",
          username: data.listenHistoryUsername ?? "",
        }
      : undefined,
    resetOptions: { keepDirtyValues: true },
  });

  const provider = useWatch({ control, name: "provider" });

  const onSubmit = (values: AccountForm) => {
    // The server keeps no username for "local", and answers with null. Sending
    // one would leave the form dirty against a value that never comes back.
    const trimmed = values.provider === "local" ? "" : values.username.trim();
    updateMutation.mutate(
      {
        listenHistoryProvider: values.provider,
        listenHistoryUsername: trimmed || null,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          reset({ provider: values.provider, username: trimmed });
          Burnt.toast({
            title: "Listening preferences saved",
            preset: "done",
          });
        },
        onError: (error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Burnt.toast({
            title: "Couldn't save preferences",
            message:
              error instanceof Error ? error.message : "Please try again.",
            preset: "error",
          });
        },
      },
    );
  };

  if (isPending) {
    return (
      <View style={styles.container}>
        <Text
          variant="caption"
          style={[styles.helper, { color: colors.subtle }]}
        >
          {HELPER_TEXT}
        </Text>
        <Skeleton width="100%" height={32} />
        <Skeleton width="100%" height={50} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <Text variant="error">Couldn&apos;t load listening preferences.</Text>
        <Button
          title="Tap to retry"
          variant="inline"
          onPress={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="caption" style={[styles.helper, { color: colors.subtle }]}>
        {HELPER_TEXT}
      </Text>

      <View style={styles.field}>
        <Text
          variant="caption"
          style={[styles.fieldLabel, { color: colors.subtle }]}
        >
          Provider
        </Text>
        <Controller
          control={control}
          name="provider"
          render={({ field: { value, onChange } }) => (
            <SegmentedRow
              value={value}
              options={providerOptions}
              onChange={onChange}
            />
          )}
        />
      </View>

      {provider === "local" ? null : (
        <Controller
          control={control}
          name="username"
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text
                variant="caption"
                style={[styles.fieldLabel, { color: colors.subtle }]}
              >
                Username
              </Text>
              <BottomSheetTextInput
                style={[inputBaseStyle, inputThemedStyle(colorScheme)]}
                placeholder={
                  provider === "listenbrainz"
                    ? "Your ListenBrainz username"
                    : "Your Last.fm username"
                }
                placeholderTextColor={colors.placeholder}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!updateMutation.isPending}
              />
            </View>
          )}
        />
      )}

      <Button
        title="Save"
        onPress={handleSubmit(onSubmit)}
        loading={updateMutation.isPending}
        disabled={!isDirty}
        style={styles.saveButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    ...Fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  saveButton: {
    marginTop: 4,
  },
});
