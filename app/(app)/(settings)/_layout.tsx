import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import {
  isListeningService,
  SERVICE_LABELS,
} from "@/components/settings/listening";
import { stackScreenOptions } from "@/constants/navigation";
import { IS_IOS } from "@/constants/platform";
import { useColors } from "@/hooks/use-colors";

export const unstable_settings = {
  anchor: "settings/index",
};

export default function SettingsLayout() {
  const colors = useColors();

  const stack = (
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
        name="settings/playback/[network]"
        options={({ route }) => ({
          title:
            (route.params as { network?: string })?.network === "cellular"
              ? "Cellular Settings"
              : "Wi-Fi Settings",
        })}
      />
      <Stack.Screen
        name="settings/appearance"
        options={{ title: "Appearance" }}
      />
      <Stack.Screen name="settings/discover" options={{ title: "Discover" }} />
      <Stack.Screen name="settings/flows" options={{ title: "Flows" }} />
      <Stack.Screen name="settings/server" options={{ title: "Server" }} />
      <Stack.Screen name="settings/about" options={{ title: "About" }} />
    </Stack>
  );

  // The iOS sheet covers the tabs and their mini player. Android opens
  // Settings above the tabs, so it docks its own.
  return IS_IOS ? stack : <MiniPlayerHost aboveTabs>{stack}</MiniPlayerHost>;
}
