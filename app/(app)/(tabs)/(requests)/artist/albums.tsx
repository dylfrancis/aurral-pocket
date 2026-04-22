import { useCallback, useRef, useState } from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { AlbumCard } from "@/components/library/AlbumCard";
import { AlbumSheet } from "@/components/library/AlbumSheet";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { useReleaseGrid } from "@/hooks/library/use-release-grid";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import type { Album } from "@/lib/types/library";

const albumConfig = {
  variant: "albums" as const,
  getDate: (a: Album) => a.releaseDate,
  getName: (a: Album) => a.albumName,
  supportsMissing: true,
  isMissing: (a: Album) =>
    a.statistics.percentOfTracks < 100 && a.statistics.sizeOnDisk === 0,
};

export default function AlbumsGridScreen() {
  const grid = useReleaseGrid<Album>(albumConfig);
  const { data: downloadStatuses } = useDownloadStatuses(grid.rawAlbums);

  const albumSheetRef = useRef<BottomSheet>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const openAlbum = useCallback((album: Album) => {
    setSelectedAlbum(album);
    albumSheetRef.current?.snapToIndex(0);
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
      renderItem={(item) => (
        <AlbumCard
          album={item}
          onPress={() => openAlbum(item)}
          fill
          downloadStatus={downloadStatuses?.[item.id]?.status}
        />
      )}
      keyExtractor={(item) => item.id}
      bottomSheet={
        <AlbumSheet
          album={selectedAlbum}
          artistName={grid.artistName}
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
