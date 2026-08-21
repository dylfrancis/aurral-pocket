import { SettingsRow } from "@/components/settings/SettingsRow";
import { Text } from "@/components/ui/Text";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useServerHealth } from "@/hooks/auth/use-server-health";
import { useColorScheme } from "@/hooks/use-color-scheme";
import Constants from "expo-constants";
import { StyleSheet, View } from "react-native";

export function AboutSection() {
  const { serverUrl } = useAuth();
  const colors = Colors[useColorScheme()];
  const version =
    (Constants.expoConfig?.extra?.fullVersion as string | undefined) ??
    Constants.expoConfig?.version ??
    "unknown";
  // Injected from .aurral-version by app.config.js — the same pin the API
  // contract workflow boots, so this cannot drift from what CI verifies.
  const testedVersion = Constants.expoConfig?.extra?.aurralVersion as
    string | undefined;

  const { data: health } = useServerHealth();
  const serverVersion = health?.appVersion;
  const drifted =
    !!serverVersion && !!testedVersion && serverVersion !== testedVersion;

  return (
    <View style={styles.container}>
      <SettingsRow
        icon="information-circle-outline"
        label="Version"
        value={`Aurral Pocket ${version}`}
      />
      {serverUrl ? (
        <SettingsRow icon="server-outline" label="Server" value={serverUrl} />
      ) : null}
      {serverVersion ? (
        <SettingsRow
          icon="cube-outline"
          label="Server version"
          value={`Aurral ${serverVersion}`}
        />
      ) : null}
      {testedVersion ? (
        <SettingsRow
          icon="git-branch-outline"
          label="Tested against"
          value={`Aurral ${testedVersion}`}
        />
      ) : null}
      {testedVersion ? (
        <Text
          variant="caption"
          style={[
            styles.helper,
            { color: drifted ? colors.warning : colors.subtle },
          ]}
        >
          {drifted
            ? `Your server runs Aurral ${serverVersion}, but this app is verified against ${testedVersion}. Endpoints it calls may have moved, changed, or not exist yet. Some features can break.`
            : `Every endpoint this app calls is verified against Aurral ${testedVersion}. Other server versions may be missing those endpoints, or may have changed them causing features to potentially break.`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
    paddingBottom: 12,
  },
});
