import { useState } from "react";
import { Alert } from "react-native";
import { FieldGroup, Host, TextInput } from "@expo/ui";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { SettingsActionMenu } from "@/components/settings/SettingsActionMenu";
import {
  SettingsNote,
  useFieldColors,
  useSettingsRow,
} from "@/components/settings/SettingsRows";
import { useAuth } from "@/contexts/auth-context";
import { useChangeServer } from "@/hooks/auth/use-change-server";
import { useLibraryScan } from "@/hooks/library/use-library-scan";
import { useSaveCustomHeaders } from "@/hooks/auth/use-save-custom-headers";
import { ApiError } from "@/lib/api/client";
import { headerRowsSchema, newHeaderRow } from "@/lib/custom-headers";
import { openTailscaleSignIn, useTailscaleStatus } from "@/lib/tailscale";
import type { TailscaleState } from "@/modules/tailscale";

const SCAN_NOTE =
  "A quick scan reads new and changed files. A full scan reads every file again, which takes longer. Either one also tries to match artists whose files have no MusicBrainz tags.";

const TAILSCALE_NOTE =
  "Aurral Pocket reaches this server over its own Tailscale connection, without the Tailscale app. Change Server removes this phone from your tailnet.";

const TAILSCALE_STATES: Record<TailscaleState, string> = {
  Running: "Connected",
  Starting: "Connecting…",
  NoState: "Connecting…",
  NeedsLogin: "Needs Sign-In",
  NeedsMachineAuth: "Waiting for Approval",
  Stopped: "Not Connected",
  Off: "Not Connected",
};

const HEADERS_NOTE =
  "Sent with every request, for a reverse proxy in front of your server. The server has to answer with a change before it’s kept.";

export function ServerScreen() {
  const row = useSettingsRow();
  const { serverUrl, tailscale } = useAuth();
  const changeServer = useChangeServer();
  const headersSections = useHeadersSections();
  const tailscaleSection = useTailscaleSection();
  const libraryScan = useLibraryScan();

  const confirmChangeServer = () =>
    Alert.alert(
      "Change server?",
      tailscale
        ? "You’ll be signed out, and Aurral Pocket forgets this server, your saved sign-in and your custom headers, and removes this phone from your tailnet."
        : "You’ll be signed out, and Aurral Pocket forgets this server, your saved sign-in and your custom headers.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change Server",
          style: "destructive",
          onPress: () => changeServer.mutate(),
        },
      ],
    );

  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section>
          {row({ label: "URL", value: serverUrl })}
        </FieldGroup.Section>
        {tailscaleSection}
        <FieldGroup.Section title="Library">
          {row({
            label: "Scan Library",
            trailing: (
              <SettingsActionMenu
                triggerLabel={libraryScan.isScanning ? "Scanning…" : "Scan"}
                accessibilityLabel="Scan Library"
                disabled={libraryScan.isScanning}
                actions={[
                  {
                    key: "quick",
                    label: "Quick Scan",
                    onPress: () =>
                      libraryScan.scan(
                        { mode: "quick" },
                        {
                          done: "Library scan complete",
                          failed: "Couldn't scan the library",
                        },
                      ),
                  },
                  {
                    key: "full",
                    label: "Full Scan",
                    onPress: () =>
                      libraryScan.scan(
                        { mode: "full" },
                        {
                          done: "Full scan complete",
                          failed: "Couldn't scan the library",
                        },
                      ),
                  },
                ]}
              />
            ),
          })}
          <FieldGroup.SectionFooter>
            <SettingsNote>{SCAN_NOTE}</SettingsNote>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
        {headersSections}
        <FieldGroup.Section>
          {row({
            label: "Change Server",
            destructive: true,
            disabled: changeServer.isPending,
            onPress: confirmChangeServer,
          })}
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}

/**
 * How the app's own Tailscale node is doing, for a server reached through it.
 * Returns the section element itself, or null: Android wraps any FieldGroup
 * child that isn't a Section in a section of its own.
 */
function useTailscaleSection() {
  const row = useSettingsRow();
  const { tailscale } = useAuth();
  const status = useTailscaleStatus();
  if (!tailscale) return null;

  const address =
    status.state === "Running"
      ? (status.tailnetIPs?.find((ip) => ip.includes(".")) ?? null)
      : null;
  const needsSignIn = status.state === "NeedsLogin" && !!status.loginURL;
  const problem =
    status.state === "NeedsMachineAuth"
      ? "An admin has to approve this phone in the Tailscale admin console."
      : status.state !== "Running" && status.error
        ? status.error
        : null;

  return (
    <FieldGroup.Section key="tailscale" title="Tailscale">
      {row({ label: "Status", value: TAILSCALE_STATES[status.state] })}
      {address ? row({ label: "Address", value: address }) : null}
      {needsSignIn
        ? row({
            label: "Sign In to Tailscale",
            action: true,
            onPress: () => void openTailscaleSignIn(),
          })
        : null}
      <FieldGroup.SectionFooter>
        <SettingsNote tone={problem ? "warning" : undefined}>
          {problem ? `${problem} ${TAILSCALE_NOTE}` : TAILSCALE_NOTE}
        </SettingsNote>
      </FieldGroup.SectionFooter>
    </FieldGroup.Section>
  );
}

/**
 * Saved values stay hidden and a header is changed by removing it and adding
 * it again, so no field ever shows a secret. That also keeps the fields plain
 * text: iOS offers to save any secure SwiftUI field as a password.
 *
 * Returns the section elements themselves, since Android wraps any FieldGroup
 * child that isn't a Section in a section of its own.
 */
function useHeadersSections() {
  const row = useSettingsRow();
  const fieldColors = useFieldColors();
  const { customHeaders } = useAuth();
  const saveHeaders = useSaveCustomHeaders();
  const [draft, setDraft] = useState<{ name: string; value: string } | null>(
    null,
  );
  const busy = saveHeaders.isPending;
  const savedHeaders = Object.entries(customHeaders);

  const draftRows = draft
    ? [
        ...savedHeaders.map(([name, value]) => newHeaderRow(name, value)),
        newHeaderRow(draft.name, draft.value),
      ]
    : [];
  const parsed = headerRowsSchema.safeParse(draftRows);
  // Only the new header's issues, and only about what's been typed: a field
  // still empty already disables Save.
  const problem = parsed.success
    ? null
    : (parsed.error.issues.find((issue) => {
        const [index, field] = issue.path as [number, "name" | "value"];
        return index === savedHeaders.length && !!draft?.[field].trim();
      })?.message ?? null);
  const draftReady =
    !!draft && !!draft.name.trim() && !!draft.value.trim() && !problem;

  const save = (headers: Record<string, string>, toastTitle: string) =>
    saveHeaders.mutate(headers, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setDraft(null);
        Burnt.toast({ title: toastTitle, preset: "done" });
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

  const confirmRemove = (name: string) =>
    Alert.alert(
      `Remove ${name}?`,
      "Aurral Pocket stops sending it. If your proxy needs it, the server has to answer without it first.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const { [name]: _removed, ...rest } = customHeaders;
            save(rest, "Header removed");
          },
        },
      ],
    );

  const addDraft = () => {
    if (!draft || !draftReady || busy) return;
    save(
      { ...customHeaders, [draft.name.trim()]: draft.value.trim() },
      "Header saved",
    );
  };

  return (
    <>
      {savedHeaders.length || !draft ? (
        <FieldGroup.Section key="headers" title="Custom Headers">
          {savedHeaders.map(([name]) =>
            row({
              key: name,
              label: name,
              value: "••••••",
              disabled: busy,
              onPress: () => confirmRemove(name),
            }),
          )}
          {draft
            ? null
            : row({
                label: "Add Header",
                action: true,
                disabled: busy,
                onPress: () => setDraft({ name: "", value: "" }),
              })}
          {draft ? null : (
            <FieldGroup.SectionFooter>
              <SettingsNote>
                {savedHeaders.length
                  ? `${HEADERS_NOTE} Tap a header to remove it.`
                  : HEADERS_NOTE}
              </SettingsNote>
            </FieldGroup.SectionFooter>
          )}
        </FieldGroup.Section>
      ) : null}
      {draft ? (
        <FieldGroup.Section key="new-header" title="New Header">
          <TextInput
            {...fieldColors}
            placeholder="Header name"
            accessibilityLabel="Header name"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            editable={!busy}
            onChangeText={(name) =>
              setDraft((current) => current && { ...current, name })
            }
          />
          <TextInput
            {...fieldColors}
            placeholder="Value"
            accessibilityLabel="Header value"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            editable={!busy}
            onChangeText={(value) =>
              setDraft((current) => current && { ...current, value })
            }
            onSubmitEditing={addDraft}
          />
          {row({
            label: busy ? "Saving…" : "Save Header",
            action: true,
            disabled: !draftReady || busy,
            onPress: addDraft,
          })}
          {row({
            label: "Cancel",
            disabled: busy,
            onPress: () => setDraft(null),
          })}
          <FieldGroup.SectionFooter>
            <SettingsNote tone={problem ? "warning" : undefined}>
              {problem ?? HEADERS_NOTE}
            </SettingsNote>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      ) : null}
    </>
  );
}
