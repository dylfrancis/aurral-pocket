import React, { forwardRef, useCallback, useRef, useState } from "react";
import { Keyboard, Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { AppSheet } from "@/components/ui/AppSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  CustomHeadersEditor,
  headerRowMessages,
} from "@/components/auth/CustomHeadersEditor";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useServerConnect } from "@/hooks/auth/use-server-connect";
import { Colors, Fonts } from "@/constants/theme";
import { ApiError } from "@/lib/api/client";
import {
  headerRowsSchema,
  newHeaderRow,
  rowsToHeaders,
} from "@/lib/custom-headers";

const connectSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .refine((v) => v.startsWith("http://") || v.startsWith("https://"), {
      message: "URL must start with http:// or https://",
    }),
  headers: headerRowsSchema,
});

type ConnectForm = z.infer<typeof connectSchema>;

function getErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.isNetworkError)
      return "Could not reach server. Check the URL and try again.";
    return "Server responded but health check failed.";
  }
  return error.message;
}

export const ConnectSheet = forwardRef<BottomSheetModal>(
  function ConnectSheet(_, ref) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme];
    const insets = useSafeAreaInsets();
    const connectMutation = useServerConnect();
    const resetRef = useRef(connectMutation.reset);
    resetRef.current = connectMutation.reset;
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const {
      control,
      handleSubmit,
      formState: { errors },
      reset,
    } = useForm<ConnectForm>({
      resolver: zodResolver(connectSchema),
      defaultValues: { url: "", headers: [newHeaderRow()] },
    });

    const onSubmit = async (data: ConnectForm) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      connectMutation.mutate({
        url: data.url.trim(),
        headers: rowsToHeaders(data.headers),
      });
    };

    // A header filled in and then folded away must still show its error.
    const submit = handleSubmit(onSubmit, (invalidFields) => {
      if (invalidFields.headers) setAdvancedOpen(true);
    });

    const handleDismiss = useCallback(() => {
      Keyboard.dismiss();
      resetRef.current();
      reset();
      setAdvancedOpen(false);
    }, [reset]);

    const errorMessage =
      errors.url?.message ?? getErrorMessage(connectMutation.error);

    return (
      <AppSheet
        ref={ref}
        background="card"
        enableDynamicSizing
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={handleDismiss}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="title" style={styles.title}>
            Connect to Server
          </Text>
          <Text variant="subtitle" style={styles.subtitle}>
            Enter the URL of your Aurral server
          </Text>
          <Pressable
            onPress={() =>
              Linking.openURL("https://github.com/lklynet/aurral#readme")
            }
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
                style={[
                  inputBaseStyle,
                  inputThemedStyle(colorScheme),
                  styles.input,
                ]}
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
                onSubmitEditing={() => submit()}
                editable={!connectMutation.isPending}
              />
            )}
          />

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setAdvancedOpen((open) => !open);
            }}
            style={({ pressed }) => [
              styles.advancedHeader,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
          >
            <Text
              variant="body"
              style={[styles.advancedLabel, { ...Fonts.medium }]}
            >
              Advanced
            </Text>
            <Ionicons
              name={advancedOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.subtle}
            />
          </Pressable>

          {advancedOpen ? (
            <View style={styles.advanced}>
              <Text variant="caption" style={styles.advancedHeading}>
                Custom Headers
              </Text>
              <Controller
                control={control}
                name="headers"
                render={({ field: { onChange, value } }) => (
                  <CustomHeadersEditor
                    rows={value}
                    onChange={onChange}
                    errors={headerRowMessages(errors.headers, value.length)}
                    editable={!connectMutation.isPending}
                  />
                )}
              />
            </View>
          ) : null}

          {errorMessage && (
            <Text variant="error" style={styles.error}>
              {errorMessage}
            </Text>
          )}

          <Button
            title="Connect"
            onPress={() => submit()}
            loading={connectMutation.isPending}
          />
        </BottomSheetScrollView>
      </AppSheet>
    );
  },
);

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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  input: {
    marginBottom: 4,
  },
  advancedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginBottom: 4,
  },
  advancedLabel: {
    flex: 1,
  },
  advanced: {
    marginBottom: 12,
  },
  advancedHeading: {
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  error: {
    marginBottom: 12,
  },
});
