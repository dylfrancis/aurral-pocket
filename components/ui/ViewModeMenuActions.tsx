import { Stack } from "expo-router";
import GridView from "@expo/material-symbols/grid_view.xml";
import ViewList from "@expo/material-symbols/view_list.xml";
import type { ViewMode } from "@/hooks/use-view-mode";

const VIEW_OPTIONS: {
  key: ViewMode;
  label: string;
  iosIcon: string;
  androidIcon: number;
}[] = [
  { key: "list", label: "List", iosIcon: "list.bullet", androidIcon: ViewList },
  {
    key: "grid",
    label: "Grid",
    iosIcon: "square.grid.2x2",
    androidIcon: GridView,
  },
];

// A plain function (not a component) so the toolbar sees the menu
// elements as direct children of the parent Menu.
export function viewModeMenuSection(
  mode: ViewMode,
  onChange: (mode: ViewMode) => void,
) {
  return (
    <Stack.Toolbar.Menu inline title="View">
      {VIEW_OPTIONS.map((option) => (
        <Stack.Toolbar.MenuAction
          key={option.key}
          icon={
            process.env.EXPO_OS === "ios"
              ? (option.iosIcon as any)
              : option.androidIcon
          }
          isOn={mode === option.key}
          onPress={() => onChange(option.key)}
        >
          {option.label}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>
  );
}
