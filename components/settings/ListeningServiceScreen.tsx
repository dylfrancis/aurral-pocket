import { useState } from "react";
import { FieldGroup, Host, Text, TextInput } from "@expo/ui";
import { useLocalSearchParams } from "expo-router";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import {
  connectedLabel,
  historyValue,
  isListeningService,
  SERVICE_LABELS,
} from "@/components/settings/listening";
import {
  SettingsNote,
  useFieldColors,
  useSettingsRow,
} from "@/components/settings/SettingsRows";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import {
  useListeningHistory,
  useUpdateListeningHistory,
} from "@/hooks/me/use-listening-history";
import {
  useLinkScrobbler,
  useScrobbleStatus,
  useUnlinkScrobbler,
} from "@/hooks/me/use-scrobbling";
import type { ScrobbleProvider, ScrobbleStatus } from "@/lib/types/scrobbling";

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Please try again.";
}

export function ListeningServiceScreen() {
  const { service } = useLocalSearchParams<{ service: string }>();

  if (!isListeningService(service)) {
    return (
      <Host style={{ flex: 1 }}>
        <FieldGroup>
          <FieldGroup.Section>
            <Text>This service isn’t one Aurral supports.</Text>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    );
  }
  return <TokenServicePage key={service} service={service} />;
}

function TokenServicePage({ service }: { service: ScrobbleProvider }) {
  const historySection = useHistorySection(service);
  const status = useScrobbleStatus();
  const placeholder = useScrobblingPlaceholder(status);
  const scrobblingSection = useTokenScrobbling(service, status.data);

  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        {historySection}
        {placeholder ?? scrobblingSection}
      </FieldGroup>
    </Host>
  );
}

// The sections are built by hooks, not components: Android wraps any
// FieldGroup child that isn't a Section in a section of its own.

function useHistorySection(service: ScrobbleProvider) {
  const row = useSettingsRow();
  const fieldColors = useFieldColors();
  const history = useListeningHistory();
  const update = useUpdateListeningHistory();
  const savedValue = historyValue(history.data, service);
  // A draft belongs to the value it was typed over. A link can fill the
  // username in on the server, and the field then shows that instead.
  const [draft, setDraft] = useState<{ base: string; text: string } | null>(
    null,
  );
  const dirty = draft?.base === savedValue && draft.text.trim() !== savedValue;
  const isKoito = service === "koito";

  const save = () => {
    if (!dirty || !draft || update.isPending) return;
    update.mutate(
      { [service]: draft.text.trim() || null },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setDraft(null);
          Burnt.toast({ title: "Listening history saved", preset: "done" });
        },
        onError: (error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Burnt.toast({
            title: "Couldn't save listening history",
            message: errorMessage(error),
            preset: "error",
          });
        },
      },
    );
  };

  return (
    <FieldGroup.Section
      key="history"
      title={isKoito ? "History · Koito URL" : "History · Username"}
    >
      {history.data ? (
        <TextInput
          {...fieldColors}
          // Remounts when the saved value changes: the server normalizes the
          // Koito URL, and a link can fill a username in.
          key={savedValue}
          defaultValue={savedValue}
          placeholder={isKoito ? "https://koito.example.com:4110" : "Username"}
          accessibilityLabel={
            isKoito ? "Koito URL" : `${SERVICE_LABELS[service]} username`
          }
          keyboardType={isKoito ? "url" : undefined}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          editable={!update.isPending}
          onChangeText={(text) => setDraft({ base: savedValue, text })}
          onSubmitEditing={save}
        />
      ) : history.isError ? (
        row({
          label: "Try Again",
          action: true,
          onPress: () => void history.refetch(),
        })
      ) : (
        row({ label: "Loading…", disabled: true })
      )}
      {dirty
        ? row({
            label: update.isPending ? "Saving…" : "Save",
            action: true,
            disabled: update.isPending,
            onPress: save,
          })
        : null}
      <FieldGroup.SectionFooter>
        <SettingsNote tone={history.isError ? "warning" : undefined}>
          {history.isError
            ? "Couldn’t load your listening history."
            : isKoito
              ? "Aurral reads your Koito plays to shape your recommendations."
              : `Aurral reads your ${SERVICE_LABELS[service]} plays to shape your recommendations. Connecting scrobbling fills this in.`}
        </SettingsNote>
      </FieldGroup.SectionFooter>
    </FieldGroup.Section>
  );
}

function useScrobblingPlaceholder(
  status: ReturnType<typeof useScrobbleStatus>,
) {
  const row = useSettingsRow();

  if (status.data) return null;
  if (status.isError) {
    return (
      <FieldGroup.Section key="scrobbling" title="Scrobbling">
        {row({
          label: "Try Again",
          action: true,
          onPress: () => void status.refetch(),
        })}
        <FieldGroup.SectionFooter>
          <SettingsNote tone="warning">Couldn’t load scrobbling.</SettingsNote>
        </FieldGroup.SectionFooter>
      </FieldGroup.Section>
    );
  }
  return (
    <FieldGroup.Section key="scrobbling" title="Scrobbling">
      {row({ label: "Loading…", disabled: true })}
    </FieldGroup.Section>
  );
}

function useDisconnect(service: ScrobbleProvider) {
  const unlink = useUnlinkScrobbler(service);
  const disconnect = () =>
    unlink.mutate(undefined, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Burnt.toast({
          title: `${SERVICE_LABELS[service]} disconnected`,
          preset: "done",
        });
      },
      onError: (error) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Burnt.toast({
          title: `Couldn't disconnect ${SERVICE_LABELS[service]}`,
          message: errorMessage(error),
          preset: "error",
        });
      },
    });
  return { disconnect, disconnecting: unlink.isPending };
}

function useTokenScrobbling(
  service: ScrobbleProvider,
  status: ScrobbleStatus | undefined,
) {
  const row = useSettingsRow();
  const fieldColors = useFieldColors();
  const hasPermission = useHasPermission();
  const link = useLinkScrobbler(service);
  const { disconnect, disconnecting } = useDisconnect(service);
  const [token, setToken] = useState("");
  // A new key remounts the field, which keeps its own text, to clear it.
  const [fieldKey, setFieldKey] = useState(0);

  if (!status) return null;

  const connection = status[service];
  const label = SERVICE_LABELS[service];
  const isKoito = service === "koito";
  // Aurral only lets an account with Access Settings link Koito, and lets
  // anyone disconnect it.
  const canLink = !isKoito || hasPermission("accessSettings");
  const busy = link.isPending || disconnecting;

  const connect = () => {
    const trimmed = token.trim();
    if (!trimmed || busy) return;
    link.mutate(trimmed, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setFieldKey((key) => key + 1);
        setToken("");
        Burnt.toast({ title: `${label} connected`, preset: "done" });
      },
      onError: (error) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        // Android shows only the title, so it carries the server's reason.
        Burnt.toast({
          title: errorMessage(error),
          message: `${label} isn't connected.`,
          preset: "error",
        });
      },
    });
  };

  const note = !canLink
    ? connection.connected
      ? "Connecting Koito again needs the Access Settings permission."
      : "Connecting Koito needs the Access Settings permission. Ask an admin."
    : isKoito
      ? "Uses the Koito URL above."
      : "Find your user token in your ListenBrainz settings.";

  return (
    <FieldGroup.Section key="scrobbling" title="Scrobbling">
      {row({
        label: "Status",
        value: connection.connected
          ? connectedLabel(connection)
          : "Not connected",
      })}
      {canLink ? (
        <TextInput
          {...fieldColors}
          key={fieldKey}
          placeholder={isKoito ? "API key" : "User token"}
          accessibilityLabel={isKoito ? "Koito API key" : "ListenBrainz token"}
          // Plain text: iOS offers to save any secure SwiftUI field as a
          // password.
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          onChangeText={setToken}
          onSubmitEditing={connect}
        />
      ) : null}
      {canLink
        ? row({
            label: link.isPending
              ? "Connecting…"
              : connection.connected
                ? `Update ${label}`
                : `Connect ${label}`,
            action: true,
            disabled: !token.trim() || busy,
            onPress: connect,
          })
        : null}
      {connection.connected
        ? row({
            label: disconnecting ? "Disconnecting…" : "Disconnect",
            destructive: true,
            disabled: busy,
            onPress: disconnect,
          })
        : null}
      <FieldGroup.SectionFooter>
        <SettingsNote>{note}</SettingsNote>
      </FieldGroup.SectionFooter>
    </FieldGroup.Section>
  );
}
