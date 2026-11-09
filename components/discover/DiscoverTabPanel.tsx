import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  active: boolean;
  children: ReactNode;
};

/**
 * Hides a tab without `display: "none"`, which (like React's <Activity>) makes
 * Fabric delete its native views: rebuilding the Playlists covers froze the UI
 * thread on every visit.
 */
export function DiscoverTabPanel({ active, children }: Props) {
  return (
    <View
      style={[styles.panel, !active && styles.hidden]}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches the gap Discover's scroll view puts between its children.
  panel: {
    gap: 12,
  },
  hidden: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
    pointerEvents: "none",
  },
});
