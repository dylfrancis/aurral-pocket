import { FieldGroup, Host, Icon } from "@expo/ui";
import Constants from "expo-constants";
import { Linking } from "react-native";
import BugReport from "@expo/material-symbols/bug_report.xml";
import Code from "@expo/material-symbols/code.xml";
import {
  SettingsNote,
  useSettingsRow,
} from "@/components/settings/SettingsRows";
import { useServerHealth } from "@/hooks/auth/use-server-health";

const REPO_URL = "https://github.com/dylfrancis/aurral-pocket";
const NEW_ISSUE_URL = "https://github.com/dylfrancis/aurral-pocket/issues/new";

const ICONS = {
  github: Icon.select({
    ios: "chevron.left.forwardslash.chevron.right",
    android: Code,
  }),
  bug: Icon.select({ ios: "ladybug", android: BugReport }),
};

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

export function AboutScreen() {
  const row = useSettingsRow();
  const version =
    (Constants.expoConfig?.extra?.fullVersion as string | undefined) ??
    Constants.expoConfig?.version ??
    "unknown";
  // Injected from .aurral-version by app.config.js, the same pin the API
  // contract workflow boots, so it can't drift from what CI verifies.
  const testedVersion = Constants.expoConfig?.extra?.aurralVersion as
    string | undefined;

  const { data: health } = useServerHealth();
  const serverVersion = health?.appVersion;
  const drifted =
    !!serverVersion && !!testedVersion && serverVersion !== testedVersion;

  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section>
          {row({ label: "Version", value: `Aurral Pocket ${version}` })}
          {serverVersion
            ? row({ label: "Server version", value: `Aurral ${serverVersion}` })
            : null}
          {testedVersion
            ? row({ label: "Tested against", value: `Aurral ${testedVersion}` })
            : null}
          {testedVersion ? (
            <FieldGroup.SectionFooter>
              <SettingsNote tone={drifted ? "warning" : undefined}>
                {drifted
                  ? `Your server runs Aurral ${serverVersion}, but this app is verified against ${testedVersion}. Endpoints it calls may have moved, changed, or not exist yet. Some features can break.`
                  : `Every endpoint this app calls is verified against Aurral ${testedVersion}. Other server versions may be missing those endpoints, or may have changed them causing features to potentially break.`}
              </SettingsNote>
            </FieldGroup.SectionFooter>
          ) : null}
        </FieldGroup.Section>
        <FieldGroup.Section>
          {row({
            icon: ICONS.github,
            label: "View on GitHub",
            onPress: () => openUrl(REPO_URL),
          })}
          {row({
            icon: ICONS.bug,
            label: "Report a bug",
            onPress: () => openUrl(NEW_ISSUE_URL),
          })}
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
