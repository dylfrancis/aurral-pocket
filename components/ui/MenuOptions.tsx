import { Stack } from "expo-router";
import FilterList from "@expo/material-symbols/filter_list.xml";
import { IS_IOS } from "@/constants/platform";

export type MenuOption<K extends string> = {
  key: K;
  label: string;
  disabled?: boolean;
  /** An SF Symbol name. */
  iosIcon?: string;
  /** A Material Symbol from @expo/material-symbols. */
  androidIcon?: number;
};

/** The icon on a screen's filter menu. */
export const FILTER_MENU_ICON = IS_IOS
  ? "line.3.horizontal.decrease"
  : FilterList;

/**
 * One checkable action per option, with the selected one on. Plain functions,
 * not components, so the toolbar sees the actions as direct children of a Menu.
 */
export function menuOptionActions<K extends string>(
  options: readonly MenuOption<K>[],
  selected: K,
  onSelect: (key: K) => void,
) {
  return options.map((option) => (
    <Stack.Toolbar.MenuAction
      key={option.key}
      icon={IS_IOS ? (option.iosIcon as any) : option.androidIcon}
      isOn={selected === option.key}
      disabled={option.disabled}
      onPress={() => onSelect(option.key)}
    >
      {option.label}
    </Stack.Toolbar.MenuAction>
  ));
}

/** The same actions as an inline menu section headed `title`. */
export function menuOptionSection<K extends string>(
  title: string,
  options: readonly MenuOption<K>[],
  selected: K,
  onSelect: (key: K) => void,
) {
  return (
    <Stack.Toolbar.Menu inline title={title}>
      {menuOptionActions(options, selected, onSelect)}
    </Stack.Toolbar.Menu>
  );
}
