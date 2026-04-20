import { AurralLogo } from "@/components/AurralLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { KEYBOARD_AVOIDING_BEHAVIOR } from "@/constants/platform";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import {
  authenticateWithBiometrics,
  useBiometricAvailability,
} from "@/hooks/auth/use-biometric-availability";
import { useLogin } from "@/hooks/auth/use-login";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ApiError } from "@/lib/api/client";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Haptics from "expo-haptics";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

function getErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.status === 401) return "Invalid username or password.";
    if (error.status === 429)
      return "Too many attempts. Please wait and try again.";
    if (error.isNetworkError)
      return "Unable to reach server. Check your connection.";
    return error.message;
  }
  return error.message;
}

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const {
    serverUrl,
    clearAll,
    rememberCredentials,
    useBiometrics,
    setRememberCredentials,
    setUseBiometrics,
  } = useAuth();
  const loginMutation = useLogin();
  const biometricLabel = useBiometricAvailability();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = (data: LoginForm) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loginMutation.mutate({
      username: data.username.trim(),
      password: data.password,
    });
  };

  const handleToggleRemember = (value: boolean) => {
    setRememberCredentials(value);
  };

  const handleToggleBiometrics = async (value: boolean) => {
    if (!value) {
      setUseBiometrics(false);
      return;
    }
    const ok = await authenticateWithBiometrics(
      `Authenticate to enable ${biometricLabel ?? "biometrics"}`,
    );
    if (ok) setUseBiometrics(true);
  };

  const errorMessage =
    errors.username?.message ??
    errors.password?.message ??
    getErrorMessage(loginMutation.error);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={KEYBOARD_AVOIDING_BEHAVIOR}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <AurralLogo size={48} />
          <Text variant="title" style={styles.title}>
            Sign In
          </Text>
          <Text variant="subtitle" style={styles.subtitle}>
            Enter your credentials to access Aurral
          </Text>
          <Text variant="caption" style={styles.serverUrl} numberOfLines={1}>
            {serverUrl}
          </Text>

          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="Username"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                textContentType="username"
                returnKeyType="next"
                editable={!loginMutation.isPending}
                style={styles.input}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit(onSubmit)}
                editable={!loginMutation.isPending}
                style={styles.input}
              />
            )}
          />

          <View style={styles.toggleGroup}>
            <Pressable
              style={styles.toggleRow}
              onPress={() => handleToggleRemember(!rememberCredentials)}
            >
              <Switch
                value={rememberCredentials}
                onValueChange={handleToggleRemember}
                trackColor={{ false: colors.separator, true: colors.brand }}
                thumbColor="#ffffff"
                style={styles.switch}
              />
              <Text variant="body" style={{ flex: 1 }}>
                Remember me
              </Text>
            </Pressable>

            {biometricLabel && (
              <View>
                <Pressable
                  style={[
                    styles.toggleRow,
                    rememberCredentials && styles.disabledRow,
                  ]}
                  onPress={() => handleToggleBiometrics(!useBiometrics)}
                  disabled={rememberCredentials}
                >
                  <Switch
                    value={useBiometrics && !rememberCredentials}
                    onValueChange={handleToggleBiometrics}
                    disabled={rememberCredentials}
                    trackColor={{ false: colors.separator, true: colors.brand }}
                    thumbColor="#ffffff"
                    style={styles.switch}
                  />
                  <Text variant="body" style={{ flex: 1 }}>
                    Use {biometricLabel}
                  </Text>
                </Pressable>
                {rememberCredentials && (
                  <Text variant="caption" style={styles.biometricHint}>
                    Turn off Remember me to use {biometricLabel}
                  </Text>
                )}
              </View>
            )}
          </View>

          {errorMessage && (
            <Text variant="error" style={styles.error}>
              {errorMessage}
            </Text>
          )}

          <Button
            title="Sign In"
            onPress={handleSubmit(onSubmit)}
            loading={loginMutation.isPending}
            style={styles.button}
          />

          <Button
            title="Change Server"
            variant="inline"
            onPress={clearAll}
            style={styles.changeServer}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 32,
    alignItems: "center",
  },
  title: {
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 4,
  },
  serverUrl: {
    marginBottom: 28,
  },
  input: {
    marginBottom: 12,
  },
  toggleGroup: {
    alignSelf: "stretch",
    gap: 4,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  disabledRow: {
    opacity: 0.4,
  },
  biometricHint: {
    marginTop: -2,
    marginBottom: 4,
  },
  error: {
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
  },
  changeServer: {
    marginTop: 24,
  },
});
