import { useCallback, useRef, useState } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ReleaseGroupCard } from "@/components/library/ReleaseGroupCard";
import { ReleaseGroupSheet } from "@/components/library/ReleaseGroupSheet";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { useReleaseGrid } from "@/hooks/library/use-release-grid";
import type { ReleaseGroup } from "@/lib/types/library";

const releaseConfig = {
  variant: "releases" as const,
  getDate: (rg: ReleaseGroup) => rg["first-release-date"],
  getName: (rg: ReleaseGroup) => rg.title,
  supportsMissing: false,
};

export function ReleasesGridScreen() {
  const grid = useReleaseGrid<ReleaseGroup>(releaseConfig);

  const rgSheetRef = useRef<BottomSheetModal>(null);
  const [selectedRG, setSelectedRG] = useState<ReleaseGroup | null>(null);

  const openReleaseGroup = useCallback((rg: ReleaseGroup) => {
    setSelectedRG(rg);
    rgSheetRef.current?.present();
  }, []);

  return (
    <ReleaseGrid
      items={grid.items}
      isLoading={grid.isLoading}
      refreshing={grid.refreshing}
      onRefresh={grid.handleRefresh}
      sortMode={grid.sortMode}
      onSortChange={grid.setSortMode}
      sortOptions={grid.sortOptions}
      searchQuery={grid.searchQuery}
      onSearchChange={grid.setSearchQuery}
      searchPlaceholder="Search releases"
      hasUnderlyingItems={grid.hasUnderlyingItems}
      emptyMessage="No releases to show"
      renderItem={(item) => (
        <ReleaseGroupCard
          releaseGroup={item}
          onPress={() => openReleaseGroup(item)}
          fill
        />
      )}
      keyExtractor={(item) => item.id}
      bottomSheet={
        <ReleaseGroupSheet
          releaseGroup={selectedRG}
          artistId={grid.artistId}
          artistName={grid.artistName}
          sheetRef={rgSheetRef}
        />
      }
    />
  );
}
