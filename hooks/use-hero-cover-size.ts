import { useContentWidth } from "@/hooks/use-side-insets";

const SIDE_MARGINS = 120;
const MAX_SIDE = 260;

/** A detail page's hero cover side, in points. */
export function useHeroCoverSize() {
  return Math.min(useContentWidth() - SIDE_MARGINS, MAX_SIDE);
}
