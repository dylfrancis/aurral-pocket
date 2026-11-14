import GridView from "@expo/material-symbols/grid_view.xml";
import ViewList from "@expo/material-symbols/view_list.xml";
import {
  menuOptionSection,
  type MenuOption,
} from "@/components/ui/MenuOptions";
import type { ViewMode } from "@/hooks/use-view-mode";

const VIEW_OPTIONS: MenuOption<ViewMode>[] = [
  { key: "list", label: "List", iosIcon: "list.bullet", androidIcon: ViewList },
  {
    key: "grid",
    label: "Grid",
    iosIcon: "square.grid.2x2",
    androidIcon: GridView,
  },
];

/** The filter menu's View section, for choosing rows or a grid. */
export function viewModeMenuSection(
  mode: ViewMode,
  onChange: (mode: ViewMode) => void,
) {
  return menuOptionSection("View", VIEW_OPTIONS, mode, onChange);
}
