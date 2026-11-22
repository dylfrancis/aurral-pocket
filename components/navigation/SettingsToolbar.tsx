import { Stack } from "expo-router";
import AccountCircle from "@expo/material-symbols/account_circle.xml";
import { IS_IOS } from "@/constants/platform";
import { useOpenSettings } from "@/hooks/use-open-settings";

/**
 * The person button that opens Settings, on the left of each tab's first
 * screen: a native search button always takes the far right.
 */
export function SettingsToolbar() {
  const openSettings = useOpenSettings();

  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        icon={IS_IOS ? "person.crop.circle" : AccountCircle}
        accessibilityLabel="Settings"
        onPress={openSettings}
      >
        Settings
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
