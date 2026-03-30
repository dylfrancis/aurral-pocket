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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useServerConnect } from '@/hooks/use-server-connect';
import { Colors } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';

function getErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.isNetworkError) return 'Could not reach server. Check the URL and try again.';
    return 'Server responded but health check failed.';
  }
  return error.message;
}

export default function ConnectScreen() {
  const [url, setUrl] = useState('');
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const connectMutation = useServerConnect();

  const handleConnect = () => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      connectMutation.reset();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    connectMutation.mutate(trimmed);
  };

  const errorMessage =
    url.trim() && !url.trim().startsWith('http://') && !url.trim().startsWith('https://')
      ? 'URL must start with http:// or https://'
      : getErrorMessage(connectMutation.error);

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
          <Text style={[styles.title, { color: colors.text }]}>
            Connect to Server
          </Text>
          <Text style={[styles.subtitle, { color: colors.subtle }]}>
            Enter the URL of your Aurral server
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
              },
            ]}
            placeholder="https://your-server.example.com"
            placeholderTextColor={colors.placeholder}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            returnKeyType="go"
            onSubmitEditing={handleConnect}
            editable={!connectMutation.isPending}
          />

          {errorMessage && (
            <Text style={[styles.error, { color: colors.error }]}>
              {errorMessage}
            </Text>
          )}

          <Pressable
            style={[
              styles.button,
              { backgroundColor: colors.buttonPrimary },
              connectMutation.isPending && styles.buttonDisabled,
            ]}
            onPress={handleConnect}
            disabled={connectMutation.isPending}
          >
            {connectMutation.isPending ? (
              <ActivityIndicator color={colors.buttonPrimaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.buttonPrimaryText }]}>
                Connect
              </Text>
            )}
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
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
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
    fontWeight: '600',
  },
});
