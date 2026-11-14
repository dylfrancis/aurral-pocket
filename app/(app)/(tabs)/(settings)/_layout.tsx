import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import {
  isListeningService,
  SERVICE_LABELS,
} from "@/components/settings/listening";
import { stackScreenOptions } from "@/constants/navigation";
import { IS_ANDROID } from "@/constants/platform";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "settings/index",
};

export default function SettingsLayout() {
  const colors = Colors[useColorScheme()];

  return (
    <MiniPlayerHost aboveTabs={IS_ANDROID}>
      <Stack
        screenOptions={{
          ...stackScreenOptions(colors),
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen
          name="settings/index"
          options={{ title: "Settings", headerLargeTitleEnabled: true }}
        />
        <Stack.Screen name="settings/account" options={{ title: "Account" }} />
        <Stack.Screen
          name="settings/listening/index"
          options={{ title: "Listening" }}
        />
        <Stack.Screen
          name="settings/listening/[service]"
          options={({ route }) => {
            const { service } = (route.params ?? {}) as { service?: string };
            return {
              title: isListeningService(service) ? SERVICE_LABELS[service] : "",
            };
          }}
        />
        <Stack.Screen
          name="settings/playback"
          options={{ title: "Playback and Storage" }}
        />
        <Stack.Screen
          name="settings/appearance"
          options={{ title: "Appearance" }}
        />
        <Stack.Screen
          name="settings/discover"
          options={{ title: "Discover" }}
        />
        <Stack.Screen name="settings/server" options={{ title: "Server" }} />
        <Stack.Screen name="settings/about" options={{ title: "About" }} />
      </Stack>
    </MiniPlayerHost>
  );
}
