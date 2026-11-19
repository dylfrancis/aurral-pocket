import ExtensionIcon from "@expo/material-symbols/extension.xml";
import { Stack } from "expo-router";
import { IS_IOS } from "@/constants/platform";
import type { PluginMenuItem } from "@/hooks/plugins/use-plugin-actions";

/**
 * Plugin actions as their own section of a toolbar menu. A plain function, not
 * a component, so the toolbar sees the section as a direct child of its Menu.
 */
export function pluginMenuSection(items: PluginMenuItem[]) {
  if (items.length === 0) return null;
  return (
    <Stack.Toolbar.Menu inline>
      {items.map((item) => (
        <Stack.Toolbar.MenuAction
          key={item.key}
          icon={IS_IOS ? "puzzlepiece.extension" : ExtensionIcon}
          disabled={item.running}
          onPress={item.run}
        >
          {item.label}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>
  );
}
