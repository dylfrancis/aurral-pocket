import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import { TRANSPARENT_HEADER } from "@/constants/navigation";
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
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: "minimal",
          ...TRANSPARENT_HEADER,
        }}
      >
        <Stack.Screen
          name="settings/index"
          options={{ title: "Settings", headerLargeTitleEnabled: true }}
        />
        <Stack.Screen name="settings/account" options={{ title: "Account" }} />
        <Stack.Screen
          name="settings/appearance"
          options={{ title: "Appearance" }}
        />
        <Stack.Screen name="settings/server" options={{ title: "Server" }} />
        <Stack.Screen name="settings/about" options={{ title: "About" }} />
      </Stack>
    </MiniPlayerHost>
  );
}
