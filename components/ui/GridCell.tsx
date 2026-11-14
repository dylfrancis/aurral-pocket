import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

/** Padding between a card grid and the screen's sides and top. */
export const GRID_EDGE_PADDING = 12;
const CARD_GAP = 12;

/** One cell of a card grid, half a gap from each neighbor. */
export function GridCell({ children }: { children: ReactNode }) {
  return <View style={styles.cell}>{children}</View>;
}

export const gridListStyles = StyleSheet.create({
  grid: {
    paddingHorizontal: GRID_EDGE_PADDING,
    paddingTop: GRID_EDGE_PADDING,
  },
  // Rows carry their own horizontal padding.
  rows: {
    paddingTop: GRID_EDGE_PADDING,
  },
});

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    paddingHorizontal: CARD_GAP / 2,
    paddingBottom: CARD_GAP,
  },
});
