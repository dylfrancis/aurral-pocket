import { StyleSheet, View, type KeyboardTypeOptions } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { Controller, useForm } from "react-hook-form";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import {
  useListeningHistory,
  useUpdateListeningHistory,
} from "@/hooks/me/use-listening-history";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type {
  ListenHistoryProvider,
  ListenHistorySettings,
  UpdateListenHistoryPayload,
} from "@/lib/types/me";

type AccountForm = Record<ListenHistoryProvider, string>;

const providerFields: {
  name: ListenHistoryProvider;
  label: string;
  accessibilityLabel: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
}[] = [
  {
    name: "lastfm",
    label: "Last.fm",
    accessibilityLabel: "Last.fm username",
    placeholder: "Username",
  },
  {
    name: "listenbrainz",
    label: "ListenBrainz",
    accessibilityLabel: "ListenBrainz username",
    placeholder: "Username",
  },
  {
    name: "koito",
    label: "Koito",
    accessibilityLabel: "Koito URL",
    placeholder: "https://koito.example.com:4110",
    keyboardType: "url",
  },
];

const HELPER_TEXT =
  "Your listening history shapes your recommendations. Add the services you " +
  "use, or leave them all empty to use only the plays Aurral records for you.";

function toForm(history: ListenHistorySettings): AccountForm {
  return {
    lastfm: history.lastfm ?? "",
    listenbrainz: history.listenbrainz ?? "",
    koito: history.koito ?? "",
  };
}

export function AccountSection() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { data, isPending, isError, refetch } = useListeningHistory();
  const updateMutation = useUpdateListeningHistory();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, dirtyFields },
  } = useForm<AccountForm>({
    // No defaultValues: they would win over `values` on the first render, and
    // reopening Settings would flash empty fields before the saved accounts.
    values: data ? toForm(data) : undefined,
    resetOptions: { keepDirtyValues: true },
  });

  const onSubmit = (values: AccountForm) => {
    // Only the fields the user touched, so a provider set elsewhere since this
    // form loaded is not overwritten.
    const payload: UpdateListenHistoryPayload = {};
    for (const { name } of providerFields) {
      if (dirtyFields[name]) payload[name] = values[name].trim() || null;
    }
    updateMutation.mutate(payload, {
      onSuccess: (next) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // The server's answer, not the typed values: it normalizes the Koito
        // URL, and the form would stay dirty against a value that never comes
        // back.
        reset(toForm(next));
        Burnt.toast({
          title: "Listening history saved",
          preset: "done",
        });
      },
      onError: (error) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Burnt.toast({
          title: "Couldn't save listening history",
          message: error instanceof Error ? error.message : "Please try again.",
          preset: "error",
        });
      },
    });
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
        {providerFields.map(({ name }) => (
          <Skeleton key={name} width="100%" height={50} />
        ))}
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <Text variant="error">Couldn&apos;t load listening history.</Text>
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

      {providerFields.map((field) => (
        <Controller
          key={field.name}
          control={control}
          name={field.name}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text
                variant="caption"
                style={[styles.fieldLabel, { color: colors.subtle }]}
              >
                {field.label}
              </Text>
              <BottomSheetTextInput
                style={[inputBaseStyle, inputThemedStyle(colorScheme)]}
                accessibilityLabel={field.accessibilityLabel}
                placeholder={field.placeholder}
                placeholderTextColor={colors.placeholder}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType={field.keyboardType}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!updateMutation.isPending}
              />
            </View>
          )}
        />
      ))}

      <Button
        title="Save"
        onPress={() => handleSubmit(onSubmit)()}
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
