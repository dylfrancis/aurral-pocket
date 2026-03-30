import React, { forwardRef, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  StyleSheet,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useServerConnect } from '@/hooks/use-server-connect';
import { Colors, Fonts } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';

function getErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.isNetworkError) return 'Could not reach server. Check the URL and try again.';
    return 'Server responded but health check failed.';
  }
  return error.message;
}

export const ConnectSheet = forwardRef<BottomSheet>(function ConnectSheet(_, ref) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  const connectMutation = useServerConnect();

  const handleConnect = async () => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      connectMutation.reset();
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    connectMutation.mutate(trimmed);
  };

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      connectMutation.reset();
    }
  }, [connectMutation]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const errorMessage =
    url.trim() && !url.trim().startsWith('http://') && !url.trim().startsWith('https://')
      ? 'URL must start with http:// or https://'
      : getErrorMessage(connectMutation.error);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.bold }]}>
          Connect to Server
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtle, fontFamily: Fonts.regular }]}>
          Enter the URL of your Aurral server
        </Text>

        <BottomSheetTextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
              color: colors.inputText,
              fontFamily: Fonts.regular,
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
          <Text style={[styles.error, { color: colors.error, fontFamily: Fonts.regular }]}>
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
            <Text style={[styles.buttonText, { color: colors.buttonPrimaryText, fontFamily: Fonts.semiBold }]}>
              Connect
            </Text>
          )}
        </Pressable>
      </BottomSheetView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 20,
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
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 17,
  },
});
