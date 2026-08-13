import { useCallback, useRef, useState } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ReleaseGroupCard } from "@/components/library/ReleaseGroupCard";
import { ReleaseGroupSheet } from "@/components/library/ReleaseGroupSheet";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { MediaRow } from "@/components/ui/MediaRow";
import { useReleaseGrid } from "@/hooks/library/use-release-grid";
import type { ReleaseGroup } from "@/lib/types/library";

function releaseYear(date?: string | null) {
  if (!date) return undefined;
  const year = new Date(date).getFullYear();
  return Number.isFinite(year) ? String(year) : undefined;
}

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
      renderListItem={(item) => (
        <MediaRow
          imageType="album"
          mbid={item.id}
          title={item.title}
          subtitle={releaseYear(item["first-release-date"])}
          onPress={() => openReleaseGroup(item)}
        />
      )}
      keyExtractor={(item) => item.id}
      bottomSheet={
        <ReleaseGroupSheet
          releaseGroup={selectedRG}
          artistId={grid.artistId}
          artistName={grid.artistName}
          artistMbid={grid.artistMbid}
          sheetRef={rgSheetRef}
        />
      }
    />
  );
}
