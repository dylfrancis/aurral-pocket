import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
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

const providerOptions: { value: ListenHistoryProvider; label: string }[] = [
  { value: "lastfm", label: "Last.fm" },
  { value: "listenbrainz", label: "ListenBrainz" },
];

export function AccountSection() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { data, isPending, isError, refetch } = useListeningHistory();
  const updateMutation = useUpdateListeningHistory();

  const savedProvider: ListenHistoryProvider =
    data?.listenHistoryProvider ?? "lastfm";
  const savedUsername = data?.listenHistoryUsername ?? "";

  const [provider, setProvider] =
    useState<ListenHistoryProvider>(savedProvider);
  const [username, setUsername] = useState(savedUsername);

  useEffect(() => {
    setProvider(savedProvider);
    setUsername(savedUsername);
  }, [savedProvider, savedUsername]);

  const trimmedUsername = username.trim();
  const isDirty = useMemo(
    () =>
      provider !== savedProvider || trimmedUsername !== (savedUsername ?? ""),
    [provider, savedProvider, trimmedUsername, savedUsername],
  );

  const handleSave = () => {
    updateMutation.mutate(
      {
        listenHistoryProvider: provider,
        listenHistoryUsername: trimmedUsername || null,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setUsername(trimmedUsername);
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
          Connect Last.fm or ListenBrainz for discovery recommendations based on
          your listening history.
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
        Connect Last.fm or ListenBrainz for discovery recommendations based on
        your listening history.
      </Text>

      <View style={styles.field}>
        <Text
          variant="caption"
          style={[styles.fieldLabel, { color: colors.subtle }]}
        >
          Provider
        </Text>
        <SegmentedRow
          value={provider}
          options={providerOptions}
          onChange={setProvider}
        />
      </View>

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
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!updateMutation.isPending}
        />
      </View>

      <Button
        title="Save"
        onPress={handleSave}
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
    fontFamily: Fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  saveButton: {
    marginTop: 4,
  },
});
