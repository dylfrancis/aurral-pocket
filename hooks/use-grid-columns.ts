import { useContentWidth } from "@/hooks/use-side-insets";

// Phones stay at the familiar 2 columns; wider screens gain more.
const MIN_CELL_WIDTH = 160;

export function useGridColumns(horizontalPadding = 0): number {
  const width = useContentWidth();
  return Math.max(2, Math.floor((width - horizontalPadding) / MIN_CELL_WIDTH));
}
