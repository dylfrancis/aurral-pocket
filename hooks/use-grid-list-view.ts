import { useMemo } from "react";
import { GRID_EDGE_PADDING } from "@/components/ui/GridCell";
import { viewModeMenuSection } from "@/components/ui/ViewModeMenuActions";
import { useGridColumns } from "@/hooks/use-grid-columns";
import { useViewMode, type ViewMode } from "@/hooks/use-view-mode";

/**
 * A list that switches between rows and a card grid, remembered under
 * `storageKey`. `viewMenuSection` is the toolbar menu's View section.
 */
export function useGridListView(
  storageKey: string,
  defaultMode: ViewMode,
  edgePadding = GRID_EDGE_PADDING,
) {
  const [viewMode, setViewMode] = useViewMode(storageKey, defaultMode);
  const gridColumns = useGridColumns(edgePadding * 2);
  const isGrid = viewMode === "grid";
  const viewMenuSection = useMemo(
    () => viewModeMenuSection(viewMode, setViewMode),
    [viewMode, setViewMode],
  );

  return {
    isGrid,
    numColumns: isGrid ? gridColumns : 1,
    viewMenuSection,
  };
}
