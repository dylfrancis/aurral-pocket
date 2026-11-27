import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Burnt from "burnt";
import {
  AppSheet,
  AppSheetScrollView,
  type Sheet,
} from "@/components/ui/AppSheet";
import * as Haptics from "expo-haptics";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  CustomHeadersEditor,
  headerRowMessages,
} from "@/components/auth/CustomHeadersEditor";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
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
import { isTailscaleAvailable, useTailscaleStatus } from "@/lib/tailscale";

const isHttpUrl = (v: string) =>
  v.startsWith("http://") || v.startsWith("https://");

const connectSchema = z
  .object({
    url: z.string().trim().min(1).refine(isHttpUrl, {
      message: "URL must start with http:// or https://",
    }),
    headers: headerRowsSchema,
    tailscale: z.boolean(),
    authKey: z.string(),
    controlURL: z.string().trim(),
  })
  // The field only shows, and only counts, with Tailscale on.
  .superRefine(({ tailscale, controlURL }, ctx) => {
    if (tailscale && controlURL && !isHttpUrl(controlURL)) {
      ctx.addIssue({
        code: "custom",
        path: ["controlURL"],
        message: "Control server must start with http:// or https://",
      });
    }
  });

type ConnectValues = z.infer<typeof connectSchema>;

function getErrorMessage(
  error: Error | null,
  throughTailscale: boolean,
): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.isNetworkError) {
      return throughTailscale
        ? "Tailscale is connected, but the server didn't answer. Check the URL, and that the server is on your tailnet."
        : "Could not reach server. Check the URL and try again.";
    }
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
  const tailscaleStatus = useTailscaleStatus();
  // Closing the sheet stops waiting on Tailscale's sign-in.
  const [closing] = useState(() => new AbortController());
  useEffect(() => () => closing.abort(), [closing]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ConnectValues>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      url: "",
      headers: [newHeaderRow()],
      tailscale: false,
      authKey: "",
      controlURL: "",
    },
  });
  const throughTailscale = useWatch({ control, name: "tailscale" });

  const onSubmit = async (data: ConnectValues) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let server;
    try {
      // Awaited, not mutate()'s onSuccess: that one is dropped if the sheet
      // is swiped away during the check, which still connects.
      server = await connectMutation.mutateAsync({
        url: data.url.trim(),
        headers: rowsToHeaders(data.headers),
        tailscale: data.tailscale
          ? {
              authKey: data.authKey.trim() || undefined,
              controlURL: data.controlURL.trim() || undefined,
            }
          : null,
        signal: closing.signal,
      });
    } catch {
      return; // The form shows the mutation's error.
    }
    const { url, health, headers, tailscale } = server;
    // Saving the server leaves this page, so the sheet goes first.
    sheet.close(() => {
      setServer(url, health, headers, tailscale).catch(() =>
        Burnt.toast({ title: "Couldn't save the server", preset: "error" }),
      );
    });
  };

  // A field filled in and then folded away must still show its error.
  const submit = handleSubmit(onSubmit, (invalidFields) => {
    if (invalidFields.headers || invalidFields.controlURL) {
      setAdvancedOpen(true);
    }
  });

  const errorMessage =
    errors.url?.message ??
    errors.controlURL?.message ??
    // Worded for the attempt that failed, whatever the switch says now.
    getErrorMessage(
      connectMutation.error,
      !!connectMutation.variables?.tailscale,
    );
  const joiningMessage =
    connectMutation.isPending &&
    throughTailscale &&
    tailscaleStatus.state !== "Running"
      ? tailscaleStatus.state === "NeedsLogin"
        ? "Sign in to Tailscale in the page that opened to let this phone join your tailnet."
        : "Joining your tailnet…"
      : null;

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
        onPress={() => Linking.openURL("https://docs.aurral.org/")}
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

      {isTailscaleAvailable ? (
        <View style={styles.tailscale}>
          <View style={styles.tailscaleRow}>
            <Text variant="body" style={styles.tailscaleLabel}>
              Connect through Tailscale
            </Text>
            <Controller
              control={control}
              name="tailscale"
              render={({ field: { onChange, value } }) => (
                <Switch
                  value={value}
                  onValueChange={(next) => {
                    Haptics.selectionAsync();
                    onChange(next);
                  }}
                  disabled={connecting}
                  accessibilityLabel="Connect through Tailscale"
                />
              )}
            />
          </View>
          <Text variant="caption">
            Aurral Pocket joins your tailnet itself, so you don’t need the
            Tailscale app or a VPN. Enter the server’s tailnet URL above.
          </Text>
        </View>
      ) : null}

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
          {throughTailscale ? (
            <View style={styles.advancedGroup}>
              <Text variant="caption" style={styles.advancedHeading}>
                Tailscale
              </Text>
              <Controller
                control={control}
                name="authKey"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      inputBaseStyle,
                      inputThemedStyle(colorScheme),
                      styles.input,
                    ]}
                    placeholder="Auth key (optional)"
                    placeholderTextColor={colors.placeholder}
                    accessibilityLabel="Tailscale auth key"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    textContentType="none"
                    editable={!connecting}
                  />
                )}
              />
              <Text variant="caption" style={styles.fieldNote}>
                From your tailnet’s admin. Leave it empty to sign in with
                Tailscale instead.
              </Text>
              <Controller
                control={control}
                name="controlURL"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      inputBaseStyle,
                      inputThemedStyle(colorScheme),
                      styles.input,
                    ]}
                    placeholder="Control server (optional)"
                    placeholderTextColor={colors.placeholder}
                    accessibilityLabel="Tailscale control server"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    textContentType="URL"
                    editable={!connecting}
                  />
                )}
              />
              <Text variant="caption" style={styles.fieldNote}>
                Only for a Headscale server. Leave it empty for Tailscale.
              </Text>
            </View>
          ) : null}
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

      {joiningMessage ? (
        <Text variant="caption" style={styles.error}>
          {joiningMessage}
        </Text>
      ) : errorMessage ? (
        <Text variant="error" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}

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
  tailscale: {
    marginTop: 8,
    marginBottom: 4,
    gap: 4,
  },
  tailscaleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tailscaleLabel: {
    flex: 1,
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
  advancedGroup: {
    marginBottom: 12,
  },
  fieldNote: {
    marginBottom: 8,
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
