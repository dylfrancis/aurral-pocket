import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AurralLogo } from '@/components/AurralLogo';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/auth-context';
import { useLogin } from '@/hooks/auth/use-login';
import { useBiometricAvailability } from '@/hooks/auth/use-biometric-availability';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';

function getErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Invalid username or password.';
    if (error.status === 429) return 'Too many attempts. Please wait and try again.';
    if (error.isNetworkError) return 'Unable to reach server. Check your connection.';
    return error.message;
  }
  return error.message;
}

function showRememberWarning(onConfirm: () => void) {
  Alert.alert(
    'Store Credentials',
    'Your password will be saved in encrypted storage on this device so you can be automatically signed back in when your session expires.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Enable', onPress: onConfirm },
    ],
  );
}

function showBiometricWarning(onConfirm: () => void, label: string) {
  Alert.alert(
    'Store Credentials',
    `Your password will be saved in encrypted storage on this device so you can use ${label} to sign back in when your session expires.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Enable', onPress: onConfirm },
    ],
  );
}

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const {
    serverUrl,
    clearAll,
    rememberCredentials,
    useBiometrics,
    setRememberCredentials,
    setUseBiometrics,
    saveCredentials,
  } = useAuth();
  const loginMutation = useLogin();
  const biometricLabel = useBiometricAvailability();

  const handleLogin = () => {
    if (!username.trim() || !password) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loginMutation.mutate(
      { username: username.trim(), password },
      {
        onSuccess: () => {
          if (rememberCredentials || useBiometrics) {
            saveCredentials(username.trim(), password);
          }
        },
      },
    );
  };

  const handleToggleRemember = (value: boolean) => {
    if (value) {
      showRememberWarning(() => setRememberCredentials(true));
    } else {
      setRememberCredentials(false);
    }
  };

  const handleToggleBiometrics = (value: boolean) => {
    if (value) {
      showBiometricWarning(
        () => setUseBiometrics(true),
        biometricLabel ?? 'biometrics',
      );
    } else {
      setUseBiometrics(false);
    }
  };

  const errorMessage =
    !username.trim() && !password
      ? null
      : getErrorMessage(loginMutation.error);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

          <Input
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            textContentType="username"
            returnKeyType="next"
            editable={!loginMutation.isPending}
            style={styles.input}
          />

          <Input
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            editable={!loginMutation.isPending}
            style={styles.input}
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
              <Pressable
                style={styles.toggleRow}
                onPress={() => handleToggleBiometrics(!useBiometrics)}
              >
                <Switch
                  value={useBiometrics}
                  onValueChange={handleToggleBiometrics}
                  trackColor={{ false: colors.separator, true: colors.brand }}
                  thumbColor="#ffffff"
                  style={styles.switch}
                />
                <Text variant="body" style={{ flex: 1 }}>
                  Use {biometricLabel}
                </Text>
              </Pressable>
            )}
          </View>

          {errorMessage && (
            <Text variant="error" style={styles.error}>
              {errorMessage}
            </Text>
          )}

          <Button
            title="Sign In"
            onPress={handleLogin}
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
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 32,
    alignItems: 'center',
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
    alignSelf: 'stretch',
    gap: 4,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
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
