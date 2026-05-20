import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { useChangePassword } from "@/hooks/me/use-change-password";
import { useLogout } from "@/hooks/auth/use-logout";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(1, "Required"),
    confirmPassword: z.string().min(1, "Required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation must match.",
    path: ["confirmPassword"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

const defaultValues: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function PasswordSection() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [expanded, setExpanded] = useState(false);

  const changePassword = useChangePassword();
  const logoutMutation = useLogout();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues,
    mode: "onChange",
  });

  const toggle = () => {
    Haptics.selectionAsync();
    if (expanded) reset(defaultValues);
    setExpanded((v) => !v);
  };

  const onSubmit = (values: PasswordForm) => {
    changePassword.mutate(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Burnt.toast({
            title: "Password updated",
            message: "Sign in again to continue.",
            preset: "done",
          });
          reset(defaultValues);
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
          <Controller
            control={control}
            name="currentPassword"
            render={({ field: { value, onChange, onBlur } }) => (
              <BottomSheetTextInput
                style={[inputBaseStyle, inputThemedStyle(colorScheme)]}
                placeholder="Current password"
                placeholderTextColor={colors.placeholder}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!changePassword.isPending}
              />
            )}
          />
          <Controller
            control={control}
            name="newPassword"
            render={({ field: { value, onChange, onBlur } }) => (
              <BottomSheetTextInput
                style={[inputBaseStyle, inputThemedStyle(colorScheme)]}
                placeholder="New password"
                placeholderTextColor={colors.placeholder}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                editable={!changePassword.isPending}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { value, onChange, onBlur } }) => (
              <BottomSheetTextInput
                style={[inputBaseStyle, inputThemedStyle(colorScheme)]}
                placeholder="Confirm new password"
                placeholderTextColor={colors.placeholder}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                editable={!changePassword.isPending}
              />
            )}
          />
          {errors.confirmPassword?.message ? (
            <Text variant="error" style={styles.mismatch}>
              {errors.confirmPassword.message}
            </Text>
          ) : null}
          <Button
            title="Update password"
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid}
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
