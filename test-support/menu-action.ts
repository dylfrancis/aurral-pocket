import Check from "@expo/material-symbols/check.xml";
import { Image } from "react-native";

/**
 * Whether a stand-in toolbar menu action shows as on: iOS passes `isOn`, and
 * Android shows a ✓ as its icon instead (see `checkableMenuItem`).
 */
export function isMenuActionOn({
  isOn,
  icon,
}: {
  isOn?: boolean;
  icon?: unknown;
}): boolean {
  return isOn ?? icon === Check;
}

type RenderedNode = {
  props: Record<string, any>;
  queryAll: (predicate: (node: RenderedNode) => boolean) => RenderedNode[];
};

/** Whether a menu item rendered as Compose views shows the ✓ that marks it on. */
export function showsMenuCheck(item: RenderedNode): boolean {
  const check = Image.resolveAssetSource(Check)?.uri;
  if (!check) return false;
  return item.queryAll((node) => node.props.source?.uri === check).length > 0;
}
