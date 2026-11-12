import { useState } from "react";
import { FieldGroup, Host, TextInput } from "@expo/ui";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import {
  SettingsNote,
  useFieldColors,
  useSettingsRow,
} from "@/components/settings/SettingsRows";
import { useAuth } from "@/contexts/auth-context";
import { useLogout } from "@/hooks/auth/use-logout";
import { useChangePassword } from "@/hooks/me/use-change-password";
import { ApiError } from "@/lib/api/client";

const ROLE_LABELS = { admin: "Admin", user: "User" } as const;

export function AccountScreen() {
  const row = useSettingsRow();
  const { user } = useAuth();
  const passwordSection = usePasswordSection();

  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section>
          {row({ label: "Username", value: user?.username })}
          {user?.role
            ? row({ label: "Role", value: ROLE_LABELS[user.role] })
            : null}
        </FieldGroup.Section>
        {passwordSection}
      </FieldGroup>
    </Host>
  );
}

/**
 * Returns the section element itself: Android wraps any FieldGroup child that
 * isn't a Section in a section of its own.
 */
function usePasswordSection() {
  const row = useSettingsRow();
  const fieldColors = useFieldColors();
  const changePassword = useChangePassword();
  const logout = useLogout();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const mismatch =
    !!newPassword && !!confirmation && newPassword !== confirmation;
  const canSubmit =
    !!currentPassword && !!newPassword && newPassword === confirmation;
  const busy = changePassword.isPending || logout.isPending;

  const submit = () => {
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
          logout.mutate();
        },
        onError: (error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          // Android shows only the title, so it has to say what to do.
          if (error instanceof ApiError && error.isReauthRequired) {
            Burnt.toast({
              title: "Sign in again with SSO",
              message: "Then you can set a password.",
              preset: "error",
            });
            return;
          }
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

  const passwordField = {
    secureTextEntry: true,
    autoCapitalize: "none",
    autoCorrect: false,
    editable: !busy,
  } as const;

  return (
    <FieldGroup.Section title="Change Password">
      <TextInput
        {...fieldColors}
        {...passwordField}
        placeholder="Current password"
        accessibilityLabel="Current password"
        autoComplete="current-password"
        onChangeText={setCurrentPassword}
      />
      <TextInput
        {...fieldColors}
        {...passwordField}
        placeholder="New password"
        accessibilityLabel="New password"
        autoComplete="new-password"
        onChangeText={setNewPassword}
      />
      <TextInput
        {...fieldColors}
        {...passwordField}
        placeholder="Confirm new password"
        accessibilityLabel="Confirm new password"
        autoComplete="new-password"
        onChangeText={setConfirmation}
        onSubmitEditing={() => {
          if (canSubmit && !busy) submit();
        }}
      />
      {row({
        label: busy ? "Updating…" : "Update Password",
        action: true,
        disabled: !canSubmit || busy,
        onPress: submit,
      })}
      <FieldGroup.SectionFooter>
        <SettingsNote tone={mismatch ? "warning" : undefined}>
          {mismatch
            ? "New password and confirmation must match."
            : "You’ll sign in again after changing it."}
        </SettingsNote>
      </FieldGroup.SectionFooter>
    </FieldGroup.Section>
  );
}
