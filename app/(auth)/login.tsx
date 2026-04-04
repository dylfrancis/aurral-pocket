import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AurralLogo } from '@/components/AurralLogo';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/auth-context';
import { useLogin } from '@/hooks/auth/use-login';
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

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { serverUrl, clearAll } = useAuth();
  const loginMutation = useLogin();

  const handleLogin = () => {
    if (!username.trim() || !password) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loginMutation.mutate({ username: username.trim(), password });
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
