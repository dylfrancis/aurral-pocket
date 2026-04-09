import React, { forwardRef, useCallback, useRef } from 'react';
import { Keyboard, Linking, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { inputBaseStyle, inputThemedStyle } from '@/components/ui/Input';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useServerConnect } from '@/hooks/auth/use-server-connect';
import { Colors } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';

const connectSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .refine((v) => v.startsWith('http://') || v.startsWith('https://'), {
      message: 'URL must start with http:// or https://',
    }),
});

type ConnectForm = z.infer<typeof connectSchema>;

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
  const connectMutation = useServerConnect();
  const resetRef = useRef(connectMutation.reset);
  resetRef.current = connectMutation.reset;

  const { control, handleSubmit, formState: { errors }, reset } = useForm<ConnectForm>({
    resolver: zodResolver(connectSchema),
    defaultValues: { url: '' },
  });

  const onSubmit = async (data: ConnectForm) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    connectMutation.mutate(data.url.trim());
  };

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      Keyboard.dismiss();
      resetRef.current();
      reset();
    }
  }, [reset]);

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

  const errorMessage = errors.url?.message ?? getErrorMessage(connectMutation.error);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        <Text variant="title" style={styles.title}>
          Connect to Server
        </Text>
        <Text variant="subtitle" style={styles.subtitle}>
          Enter the URL of your Aurral server
        </Text>
        <Pressable
          onPress={() => Linking.openURL('https://github.com/lklynet/aurral#readme')}
          style={styles.link}
        >
          <Text variant="caption" style={{ color: colors.brand }}>
            How can I get my own Aurral server?
          </Text>
          <Ionicons name="open-outline" size={13} color={colors.brand} />
        </Pressable>

        <Controller
          control={control}
          name="url"
          render={({ field: { onChange, onBlur, value } }) => (
            <BottomSheetTextInput
              style={[inputBaseStyle, inputThemedStyle(colorScheme), styles.input]}
              placeholder="https://your-server.example.com"
              placeholderTextColor={colors.placeholder}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textContentType="URL"
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onSubmit)}
              editable={!connectMutation.isPending}
            />
          )}
        />

        {errorMessage && (
          <Text variant="error" style={styles.error}>
            {errorMessage}
          </Text>
        )}

        <Button
          title="Connect"
          onPress={handleSubmit(onSubmit)}
          loading={connectMutation.isPending}
        />
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
    marginBottom: 4,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  error: {
    marginBottom: 12,
  },
});
