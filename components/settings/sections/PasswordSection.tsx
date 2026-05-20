import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { useChangePassword } from "@/hooks/me/use-change-password";
import { useLogout } from "@/hooks/auth/use-logout";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

export function PasswordSection() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [expanded, setExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePassword = useChangePassword();
  const logoutMutation = useLogout();

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const toggle = () => {
    Haptics.selectionAsync();
    if (expanded) reset();
    setExpanded((v) => !v);
  };

  const matches = newPassword.length > 0 && newPassword === confirmPassword;
  const canSave =
    currentPassword.length > 0 && matches && !changePassword.isPending;

  const handleSave = () => {
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Burnt.toast({
            title: "Password updated",
            message: "Sign in again to continue.",
            preset: "done",
          });
          reset();
          setExpanded(false);
          logoutMutation.mutate();
        },
        onError: (error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Burnt.toast({
            title: "Couldn't update password",
            message:
              error instanceof Error ? error.message : "Please try again.",
            preset: "error",
          });
        },
      },
    );
  };

  return (
    <View>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Ionicons
          name="key-outline"
          size={20}
          color={colors.subtle}
          style={styles.icon}
        />
        <Text
          variant="body"
          style={[
            styles.headerLabel,
            { color: colors.text, fontFamily: Fonts.medium },
          ]}
        >
          Change password
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.subtle}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.form}>
          <BottomSheetTextInput
            style={[inputBaseStyle, inputThemedStyle(colorScheme)]}
            placeholder="Current password"
            placeholderTextColor={colors.placeholder}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!changePassword.isPending}
          />
          <BottomSheetTextInput
            style={[inputBaseStyle, inputThemedStyle(colorScheme)]}
            placeholder="New password"
            placeholderTextColor={colors.placeholder}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            editable={!changePassword.isPending}
          />
          <BottomSheetTextInput
            style={[inputBaseStyle, inputThemedStyle(colorScheme)]}
            placeholder="Confirm new password"
            placeholderTextColor={colors.placeholder}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            editable={!changePassword.isPending}
          />
          {confirmPassword.length > 0 && !matches ? (
            <Text variant="error" style={styles.mismatch}>
              New password and confirmation must match.
            </Text>
          ) : null}
          <Button
            title="Update password"
            onPress={handleSave}
            disabled={!canSave}
            loading={changePassword.isPending}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  icon: {
    width: 22,
  },
  headerLabel: {
    flex: 1,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.6,
  },
  form: {
    paddingTop: 4,
    gap: 12,
  },
  mismatch: {
    textAlign: "left",
  },
});
