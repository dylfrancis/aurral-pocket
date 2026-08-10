import { ActivityIndicator, StyleSheet, View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import {
  useApproveBlockedJob,
  useDenyBlockedJob,
} from "@/hooks/activity/use-review-job";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts, Radius } from "@/constants/theme";

type ReviewActionsProps = {
  jobId: string;
};

/**
 * Approve/deny for a blocked download. Both decisions remove the row from
 * Review, so the buttons disable together while either is in flight.
 */
export function ReviewActions({ jobId }: ReviewActionsProps) {
  const colors = Colors[useColorScheme()];
  const approve = useApproveBlockedJob();
  const deny = useDenyBlockedJob();

  const busy = approve.isPending || deny.isPending;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Deny download"
        disabled={busy}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deny.mutate(jobId);
        }}
        style={[
          styles.button,
          { borderColor: colors.separator },
          busy && styles.busy,
        ]}
      >
        {deny.isPending ? (
          <ActivityIndicator size="small" color={colors.subtle} />
        ) : (
          <>
            <Ionicons name="close" size={16} color={colors.error} />
            <Text
              variant="caption"
              style={[styles.label, { color: colors.error }]}
            >
              Deny
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Approve download"
        disabled={busy}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          approve.mutate(jobId);
        }}
        style={[
          styles.button,
          { backgroundColor: colors.brand, borderColor: colors.brand },
          busy && styles.busy,
        ]}
      >
        {approve.isPending ? (
          <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
        ) : (
          <>
            <Ionicons
              name="checkmark"
              size={16}
              color={colors.buttonPrimaryText}
            />
            <Text
              variant="caption"
              style={[styles.label, { color: colors.buttonPrimaryText }]}
            >
              Approve
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 96,
    minHeight: 32,
  },
  busy: {
    opacity: 0.6,
  },
  label: {
    fontFamily: Fonts.medium,
  },
});
