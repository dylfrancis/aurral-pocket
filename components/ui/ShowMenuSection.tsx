import { Stack } from "expo-router";

export type ShowOption<K extends string> = {
  key: K;
  label: string;
  disabled?: boolean;
};

/**
 * A plain function, not a component, so the toolbar sees the menu elements as
 * direct children of its Menu.
 */
export function showMenuSection<K extends string>(
  options: ShowOption<K>[],
  selected: K,
  onSelect: (key: K) => void,
) {
  return (
    <Stack.Toolbar.Menu inline title="Show">
      {options.map((option) => (
        <Stack.Toolbar.MenuAction
          key={option.key}
          isOn={selected === option.key}
          disabled={option.disabled}
          onPress={() => onSelect(option.key)}
        >
          {option.label}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>
  );
}
