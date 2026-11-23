import { useState } from "react";
import { Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Burnt from "burnt";
import {
  AppSheet,
  AppSheetScrollView,
  type Sheet,
} from "@/components/ui/AppSheet";
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
import { useAuth } from "@/contexts/auth-context";
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

type ConnectValues = z.infer<typeof connectSchema>;

function getErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.isNetworkError)
      return "Could not reach server. Check the URL and try again.";
    return "Server responded but health check failed.";
  }
  return error.message;
}

/** The form mounts only while the sheet is up, so each opening starts blank. */
export function ConnectSheet({ sheet }: { sheet: Sheet }) {
  return (
    <AppSheet sheet={sheet} background="card">
      <ConnectForm sheet={sheet} />
    </AppSheet>
  );
}

function ConnectForm({ sheet }: { sheet: Sheet }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { setServer } = useAuth();
  const connectMutation = useServerConnect();
  // Held through a success too, while the sheet slides away.
  const connecting = connectMutation.isPending || connectMutation.isSuccess;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ConnectValues>({
    resolver: zodResolver(connectSchema),
    defaultValues: { url: "", headers: [newHeaderRow()] },
  });

  const onSubmit = async (data: ConnectValues) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let server;
    try {
      // Awaited, not mutate()'s onSuccess: that one is dropped if the sheet
      // is swiped away during the check, which still connects.
      server = await connectMutation.mutateAsync({
        url: data.url.trim(),
        headers: rowsToHeaders(data.headers),
      });
    } catch {
      return; // The form shows the mutation's error.
    }
    const { url, health, headers } = server;
    // Saving the server leaves this page, so the sheet goes first.
    sheet.close(() => {
      setServer(url, health, headers).catch(() =>
        Burnt.toast({ title: "Couldn't save the server", preset: "error" }),
      );
    });
  };

  // A header filled in and then folded away must still show its error.
  const submit = handleSubmit(onSubmit, (invalidFields) => {
    if (invalidFields.headers) setAdvancedOpen(true);
  });

  const errorMessage =
    errors.url?.message ?? getErrorMessage(connectMutation.error);

  return (
    <AppSheetScrollView
      contentContainerStyle={styles.content}
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
          <TextInput
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
            editable={!connecting}
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
                editable={!connecting}
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

      <Button title="Connect" onPress={() => submit()} loading={connecting} />
    </AppSheetScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
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
