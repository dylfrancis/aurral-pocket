import { Linking } from "react-native";
import { SettingsRow } from "@/components/settings/SettingsRow";

const REPO_URL = "https://github.com/dylfrancis/aurral-pocket";
const NEW_ISSUE_URL = "https://github.com/dylfrancis/aurral-pocket/issues/new";

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

export function LinksSection() {
  return (
    <>
      <SettingsRow
        icon="logo-github"
        label="View on GitHub"
        onPress={() => openUrl(REPO_URL)}
        showChevron
      />
      <SettingsRow
        icon="bug-outline"
        label="Report a bug"
        onPress={() => openUrl(NEW_ISSUE_URL)}
        showChevron
      />
    </>
  );
}
