import { FieldGroup, Host } from "@expo/ui";
import { useRouter } from "expo-router";
import {
  LISTENING_SERVICES,
  SERVICE_LABELS,
  serviceSummary,
} from "@/components/settings/listening";
import {
  SettingsNote,
  useSettingsRow,
} from "@/components/settings/SettingsRows";
import { useListeningHistory } from "@/hooks/me/use-listening-history";
import { useScrobbleStatus } from "@/hooks/me/use-scrobbling";

export function ListeningScreen() {
  const router = useRouter();
  const row = useSettingsRow();
  const history = useListeningHistory();
  const status = useScrobbleStatus();
  const failed = history.isError || status.isError;

  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section title="Services">
          {LISTENING_SERVICES.map((service) =>
            row({
              key: service,
              label: SERVICE_LABELS[service],
              value:
                history.data && status.data
                  ? serviceSummary(history.data[service], status.data[service])
                  : null,
              opensPage: true,
              onPress: () =>
                router.push({
                  pathname: "/settings/listening/[service]",
                  params: { service },
                }),
            }),
          )}
          {failed
            ? row({
                label: "Try Again",
                action: true,
                onPress: () => {
                  if (history.isError) void history.refetch();
                  if (status.isError) void status.refetch();
                },
              })
            : null}
          <FieldGroup.SectionFooter>
            <SettingsNote tone={failed ? "warning" : undefined}>
              {failed
                ? "Couldn’t load your listening services."
                : "Your history shapes recommendations. Scrobbling sends what you play."}
            </SettingsNote>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
