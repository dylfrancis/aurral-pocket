import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  useBiometricAvailability,
  authenticateWithBiometrics,
} from "@/hooks/auth/use-biometric-availability";
import { Colors, Fonts } from "@/constants/theme";
import { login } from "@/lib/api/auth";
import { ApiError, notifyReAuthResult } from "@/lib/api/client";
import { SecureStorage } from "@/lib/storage";
import { authKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";

const reAuthSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type ReAuthForm = z.infer<typeof reAuthSchema>;

function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.status === 401) return "Invalid password.";
    if (error.status === 429) return "Too many attempts. Please wait.";
    if (error.isNetworkError) return "Unable to reach server.";
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function ReAuthModal() {
  const {
    user,
    serverUrl,
    sessionExpired,
    useBiometrics,
    hasCredentials,
    dismissSessionExpired,
    setAuth,
    clearAuth,
  } = useAuth();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const biometricLabel = useBiometricAvailability();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReAuthForm>({
    resolver: zodResolver(reAuthSchema),
    defaultValues: { password: "" },
  });

  const handleReAuth = async (pw?: string) => {
    const pass = pw;
    if (!pass || !user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await login({ username: user.username, password: pass });
      await setAuth(data.token, data.user, data.expiresAt);
      await queryClient.invalidateQueries({
        queryKey: authKeys.me(serverUrl ?? ""),
      });
      notifyReAuthResult(true);
      dismissSessionExpired();
      reset();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (data: ReAuthForm) => handleReAuth(data.password);

  const handleBiometric = async () => {
    const success = await authenticateWithBiometrics();
    if (!success) return;
    const creds = await SecureStorage.getCredentials();
    if (creds) {
      await handleReAuth(creds.password);
    }
  };

  const handleSignOut = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    notifyReAuthResult(false);
    dismissSessionExpired();
    await clearAuth();
  };

  const showBiometric = useBiometrics && hasCredentials && !!biometricLabel;

  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (!sessionExpired) {
      autoTriggeredRef.current = false;
      return;
    }
    if (!showBiometric || autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;
    handleBiometric();
    // handleBiometric is stable within a render; we intentionally avoid adding
    // it to deps to prevent re-firing on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionExpired, showBiometric]);

  return (
    <Modal
      visible={sessionExpired}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={styles.backdrop} onPress={() => {}} />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Ionicons
            name="time-outline"
            size={36}
            color={colors.brand}
            style={styles.icon}
          />
          <Text variant="title" style={styles.title}>
            Session Expired
          </Text>
          <Text variant="subtitle" style={styles.subtitle}>
            Enter your password to continue as{" "}
            <Text
              variant="subtitle"
              style={{ fontFamily: Fonts.semiBold, color: colors.text }}
            >
              {user?.username}
            </Text>
          </Text>

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="Password"
                value={value}
                onChangeText={(t) => {
                  onChange(t);
                  setError(null);
                }}
                onBlur={onBlur}
                secureTextEntry
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit(onSubmit)}
                editable={!loading}
                style={styles.input}
              />
            )}
          />

          {(errors.password?.message || error != null) && (
            <Text variant="error" style={styles.error}>
              {errors.password?.message ?? getErrorMessage(error) ?? ""}
            </Text>
          )}

          <Button
            title="Continue"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
            style={styles.button}
          />

          {showBiometric && (
            <Button
              title={`Use ${biometricLabel}`}
              variant="inline"
              onPress={handleBiometric}
              style={styles.biometric}
            />
          )}

          <Button
            title="Sign Out"
            variant="inline"
            onPress={handleSignOut}
            style={styles.signOut}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  card: {
    width: "85%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    marginBottom: 6,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
  },
  error: {
    marginBottom: 12,
  },
  button: {
    marginTop: 4,
  },
  biometric: {
    marginTop: 12,
  },
  signOut: {
    marginTop: 8,
  },
});
