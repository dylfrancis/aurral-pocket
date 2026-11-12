import { Stack } from "expo-router";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import Settings from "@expo/material-symbols/settings.xml";
import Update from "@expo/material-symbols/update.xml";
import { useOpenOverflowScreen } from "@/hooks/use-open-overflow-screen";

/**
 * Android's ⋮ menu for a tab's root screen, inside its right `Stack.Toolbar`.
 * Render it behind `IS_ANDROID`: on iOS these screens are tabs, and the iOS
 * toolbar drops any child that isn't one of its own items.
 */
export function OverflowMenu() {
  const open = useOpenOverflowScreen();

  return (
    <Stack.Toolbar.Menu icon={MoreVert} accessibilityLabel="More options">
      <Stack.Toolbar.MenuAction icon={Update} onPress={() => open("activity")}>
        Activity
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        icon={Settings}
        onPress={() => open("settings")}
      >
        Settings
      </Stack.Toolbar.MenuAction>
    </Stack.Toolbar.Menu>
  );
}
