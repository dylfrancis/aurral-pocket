import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AurralLogo } from '@/components/AurralLogo';
import { useAuth } from '@/contexts/auth-context';
import { useLogin } from '@/hooks/use-login';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';
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
  const colorScheme = useColorScheme() ?? 'light';
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

  const handleChangeServer = () => {
    clearAll();
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
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.bold }]}>
            Sign In
          </Text>
          <Text style={[styles.subtitle, { color: colors.subtle, fontFamily: Fonts.regular }]}>
            Enter your credentials to access Aurral
          </Text>
          <Text
            style={[styles.serverUrl, { color: colors.subtle, fontFamily: Fonts.regular }]}
            numberOfLines={1}
          >
            {serverUrl}
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
                fontFamily: Fonts.regular,
              },
            ]}
            placeholder="Username"
            placeholderTextColor={colors.placeholder}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            returnKeyType="next"
            editable={!loginMutation.isPending}
          />

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
                fontFamily: Fonts.regular,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={colors.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            editable={!loginMutation.isPending}
          />

          {errorMessage && (
            <Text style={[styles.error, { color: colors.error, fontFamily: Fonts.regular }]}>
              {errorMessage}
            </Text>
          )}

          <Pressable
            style={[
              styles.button,
              { backgroundColor: colors.buttonPrimary },
              loginMutation.isPending && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color={colors.buttonPrimaryText} />
            ) : (
              <Text
                style={[styles.buttonText, { color: colors.buttonPrimaryText, fontFamily: Fonts.semiBold }]}
              >
                Sign In
              </Text>
            )}
          </Pressable>

          <Pressable style={styles.changeServer} onPress={handleChangeServer}>
            <Text style={[styles.changeServerText, { color: colors.brand, fontFamily: Fonts.medium }]}>
              Change Server
            </Text>
          </Pressable>
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
    fontSize: 28,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  serverUrl: {
    fontSize: 13,
    marginBottom: 28,
  },
  input: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 17,
  },
  changeServer: {
    marginTop: 24,
    padding: 8,
  },
  changeServerText: {
    fontSize: 15,
  },
});
