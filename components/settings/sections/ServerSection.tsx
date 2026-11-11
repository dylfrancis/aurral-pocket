import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CustomHeadersEditor,
  headerRowMessages,
} from "@/components/auth/CustomHeadersEditor";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useSaveCustomHeaders } from "@/hooks/auth/use-save-custom-headers";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ApiError } from "@/lib/api/client";
import {
  headerRowsSchema,
  headersToRows,
  rowsToHeaders,
} from "@/lib/custom-headers";

const headersFormSchema = z.object({ headers: headerRowsSchema });

type HeadersForm = z.infer<typeof headersFormSchema>;

function sameHeaders(a: Record<string, string>, b: Record<string, string>) {
  const aKeys = Object.keys(a);
  return (
    aKeys.length === Object.keys(b).length &&
    aKeys.every((key) => b[key] === a[key])
  );
}

export function ServerSection() {
  const colors = Colors[useColorScheme()];
  const { serverUrl, customHeaders } = useAuth();
  const saveHeaders = useSaveCustomHeaders();
  const [expanded, setExpanded] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HeadersForm>({
    resolver: zodResolver(headersFormSchema),
    defaultValues: { headers: [] },
  });

  const headerCount = Object.keys(customHeaders).length;
  const rows = useWatch({ control, name: "headers" });
  const unchanged = sameHeaders(rowsToHeaders(rows), customHeaders);

  const toggle = () => {
    Haptics.selectionAsync();
    // Opened on what's saved now, so an edit abandoned earlier doesn't return.
    if (!expanded) reset({ headers: headersToRows(customHeaders) });
    setExpanded((open) => !open);
  };

  const onSubmit = ({ headers }: HeadersForm) => {
    saveHeaders.mutate(rowsToHeaders(headers), {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Burnt.toast({ title: "Headers saved", preset: "done" });
        setExpanded(false);
      },
      onError: (error) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        // Android shows only the title, so it has to say what happened.
        const offline = error instanceof ApiError && error.isNetworkError;
        Burnt.toast({
          title: offline
            ? "Couldn't reach the server"
            : "Server refused these headers",
          message: offline
            ? "Headers not saved. Check your connection."
            : `Headers not saved. ${error.message}`,
          preset: "error",
        });
      },
    });
  };

  return (
    <View>
      <SettingsRow icon="server-outline" label="Server" value={serverUrl} />

      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Ionicons
          name="options-outline"
          size={20}
          color={colors.subtle}
          style={styles.icon}
        />
        <Text
          variant="body"
          style={[styles.headerLabel, { color: colors.text, ...Fonts.medium }]}
        >
          Custom headers
        </Text>
        {headerCount > 0 ? (
          <Text variant="body" style={{ color: colors.subtle }}>
            {headerCount}
          </Text>
        ) : null}
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.subtle}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.form}>
          <Controller
            control={control}
            name="headers"
            render={({ field: { value, onChange } }) => (
              <CustomHeadersEditor
                rows={value}
                onChange={onChange}
                errors={headerRowMessages(errors.headers, value.length)}
                editable={!saveHeaders.isPending}
              />
            )}
          />
          <Button
            title="Save headers"
            onPress={() => handleSubmit(onSubmit)()}
            disabled={unchanged}
            loading={saveHeaders.isPending}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  icon: {
    width: 22,
  },
  headerLabel: {
    flex: 1,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.6,
  },
  form: {
    paddingTop: 4,
    gap: 12,
  },
});
