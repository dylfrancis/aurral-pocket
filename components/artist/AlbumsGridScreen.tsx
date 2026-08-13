import { useCallback, useRef, useState } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { AlbumCard } from "@/components/library/AlbumCard";
import { AlbumSheet } from "@/components/library/AlbumSheet";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { MediaRow } from "@/components/ui/MediaRow";
import { useReleaseGrid } from "@/hooks/library/use-release-grid";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import type { Album } from "@/lib/types/library";

function releaseYear(date?: string | null) {
  if (!date) return undefined;
  const year = new Date(date).getFullYear();
  return Number.isFinite(year) ? String(year) : undefined;
}

const albumConfig = {
  variant: "albums" as const,
  getDate: (a: Album) => a.releaseDate,
  getName: (a: Album) => a.albumName,
  supportsMissing: true,
  isMissing: (a: Album) =>
    a.statistics.percentOfTracks < 100 && a.statistics.sizeOnDisk === 0,
};

export function AlbumsGridScreen() {
  const grid = useReleaseGrid<Album>(albumConfig);
  const { data: downloadStatuses } = useDownloadStatuses(grid.rawAlbums);

  const albumSheetRef = useRef<BottomSheetModal>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const openAlbum = useCallback((album: Album) => {
    setSelectedAlbum(album);
    albumSheetRef.current?.present();
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
      searchPlaceholder="Search albums"
      hasUnderlyingItems={grid.hasUnderlyingItems}
      emptyMessage="No albums to show"
      renderItem={(item) => (
        <AlbumCard
          album={item}
          onPress={() => openAlbum(item)}
          fill
          downloadStatus={downloadStatuses?.[item.id]?.status}
        />
      )}
      renderListItem={(item) => (
        <MediaRow
          imageType="album"
          mbid={item.mbid}
          title={item.albumName}
          subtitle={releaseYear(item.releaseDate)}
          onPress={() => openAlbum(item)}
        />
      )}
      keyExtractor={(item) => item.id}
      bottomSheet={
        <AlbumSheet
          album={selectedAlbum}
          artistName={grid.artistName}
          artistMbid={grid.artistMbid}
          sheetRef={albumSheetRef}
          onDeleted={() => setSelectedAlbum(null)}
          downloadStatus={
            selectedAlbum
              ? downloadStatuses?.[selectedAlbum.id]?.status
              : undefined
          }
        />
      }
    />
  );
}
