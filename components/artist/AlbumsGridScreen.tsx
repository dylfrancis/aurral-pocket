import { useCallback } from "react";
import { useRouter } from "expo-router";
import { AlbumCard } from "@/components/library/AlbumCard";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { MediaRow } from "@/components/ui/MediaRow";
import { useReleaseGrid } from "@/hooks/library/use-release-grid";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { albumRouteParams } from "@/lib/library-read";
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
  const router = useRouter();

  // A bare path, so expo-router resolves it inside the current tab group.
  const openAlbum = useCallback(
    (album: Album) => {
      router.push({
        pathname: "/album/[ref]",
        params: albumRouteParams(album, grid.artistName, grid.artistMbid),
      });
    },
    [router, grid.artistName, grid.artistMbid],
  );

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
    />
  );
}
