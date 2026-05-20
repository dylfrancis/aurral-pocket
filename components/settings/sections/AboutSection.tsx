import { StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { useAuth } from "@/contexts/auth-context";

export function AboutSection() {
  const { serverUrl } = useAuth();
  const version = Constants.expoConfig?.version ?? "unknown";

  return (
    <View style={styles.container}>
      <SettingsRow
        icon="information-circle-outline"
        label="Version"
        value={`Aurral ${version}`}
      />
      {serverUrl ? (
        <SettingsRow icon="server-outline" label="Server" value={serverUrl} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
});
