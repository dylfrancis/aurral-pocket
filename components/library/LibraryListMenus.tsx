import type { ReactElement } from "react";
import { Stack } from "expo-router";
import SwapVert from "@expo/material-symbols/swap_vert.xml";
import {
  FILTER_MENU_ICON,
  menuOptionActions,
  menuOptionSection,
  type MenuOption,
} from "@/components/ui/MenuOptions";
import { IS_IOS } from "@/constants/platform";
import type { LibraryStatus } from "@/lib/types/library";

const SORT_MENU_ICON = IS_IOS ? "arrow.up.arrow.down" : SwapVert;

// Material Symbols ship outlined only, so Android marks a filter with a dot.
const FILTER_ON_ICON = IS_IOS
  ? "line.3.horizontal.decrease.circle.fill"
  : FILTER_MENU_ICON;

type StatusKey = LibraryStatus | "any";

const STATUS_OPTIONS: MenuOption<StatusKey>[] = [
  { key: "any", label: "Any Status" },
  { key: "monitored", label: "Monitored" },
  { key: "unmonitored", label: "Not Monitored" },
  { key: "missing", label: "Missing Tracks" },
];

/** A Library list's Sort button. */
export function sortMenu<K extends string>(
  options: readonly MenuOption<K>[],
  selected: K,
  onSelect: (key: K) => void,
) {
  return (
    <Stack.Toolbar.Menu
      icon={SORT_MENU_ICON}
      title="Sort By"
      accessibilityLabel="Sort"
    >
      {menuOptionActions(options, selected, onSelect)}
    </Stack.Toolbar.Menu>
  );
}

/** Inline sections from menuOptionSection, in the order they show. */
export type FilterSections = {
  show?: ReactElement;
  status?: ReactElement;
  view?: ReactElement;
};

/**
 * A Library list's Filter button. Its icon marks when Show or Status is
 * narrowing the list, which matters because both outlive a relaunch.
 */
export function filterMenu(
  { show, status, view }: FilterSections,
  filtered: boolean,
) {
  // No title: its sections are headed, and iOS caps a menu's height, so a
  // title row would push View's last option out of sight.
  return (
    <Stack.Toolbar.Menu
      icon={filtered ? FILTER_ON_ICON : FILTER_MENU_ICON}
      accessibilityLabel={filtered ? "Filter, on" : "Filter"}
    >
      {show}
      {status}
      {view}
      {filtered && !IS_IOS && <Stack.Toolbar.Badge />}
    </Stack.Toolbar.Menu>
  );
}

/** The Filter menu's Status section. */
export function statusSection(
  status: LibraryStatus | null,
  onSelect: (status: LibraryStatus | null) => void,
  { disabled = false } = {},
) {
  return menuOptionSection(
    "Status",
    disabled
      ? STATUS_OPTIONS.map((option) => ({ ...option, disabled }))
      : STATUS_OPTIONS,
    status ?? "any",
    (key) => onSelect(key === "any" ? null : key),
  );
}
