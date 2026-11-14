import { useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { AlbumCard } from "@/components/library/AlbumCard";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { MediaRow } from "@/components/ui/MediaRow";
import { showMenuSection } from "@/components/ui/ShowMenuSection";
import { SavedMark, albumSavedId } from "@/components/offline/SavedMark";
import { SEARCH_PLACEHOLDERS } from "@/constants/navigation";
import { useReleaseGrid } from "@/hooks/library/use-release-grid";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { albumDownloadStatus, albumRouteParams } from "@/lib/library-read";
import { useSavedIds } from "@/lib/offline/saved-library";
import type { Album } from "@/lib/types/library";
import { releaseYear } from "@/lib/date-time";

const albumConfig = {
  variant: "albums" as const,
  getDate: (a: Album) => a.releaseDate,
  getName: (a: Album) => a.albumName,
  isMissing: (a: Album) =>
    a.statistics.percentOfTracks < 100 && a.statistics.sizeOnDisk === 0,
};

type Show = "all" | "saved";

export function AlbumsGridScreen() {
  const grid = useReleaseGrid<Album>(albumConfig);
  const { data: downloadStatuses } = useDownloadStatuses(grid.rawAlbums);
  const router = useRouter();

  const [show, setShow] = useState<Show>("all");
  const savedIds = useSavedIds("album");
  const isSaved = (album: Album) => {
    const id = albumSavedId(album);
    return !!id && savedIds.has(id);
  };
  const showSaved = show === "saved";
  const items = showSaved ? grid.items.filter(isSaved) : grid.items;
  const showSection = useMemo(
    () =>
      showMenuSection<Show>(
        [
          { key: "all", label: "All Albums" },
          { key: "saved", label: "Saved Offline" },
        ],
        show,
        setShow,
      ),
    [show],
  );

  // A bare path, so expo-router resolves it inside the current tab group.
  const openAlbum = useCallback(
    (album: Album) => {
      router.push({
        pathname: "/album/[ref]",
        params: albumRouteParams(
          album,
          grid.artistName,
          grid.artistMbid,
          albumDownloadStatus(downloadStatuses, album),
        ),
      });
    },
    [router, grid.artistName, grid.artistMbid, downloadStatuses],
  );

  return (
    <ReleaseGrid
      items={items}
      isLoading={grid.isLoading}
      refreshing={grid.refreshing}
      onRefresh={grid.handleRefresh}
      sortMode={grid.sortMode}
      onSortChange={grid.setSortMode}
      sortOptions={grid.sortOptions}
      searchQuery={grid.searchQuery}
      onSearchChange={grid.setSearchQuery}
      searchPlaceholder={SEARCH_PLACEHOLDERS.artistAlbums}
      // With none saved here, the empty state says so rather than "no
      // results"; a search that finds none still says that.
      hasUnderlyingItems={
        showSaved
          ? items.length > 0 || grid.searchQuery.trim() !== ""
          : grid.hasUnderlyingItems
      }
      emptyMessage={showSaved ? "No albums saved offline" : "No albums to show"}
      emptyIcon={showSaved ? "arrow-down-circle-outline" : undefined}
      showSection={showSection}
      renderItem={(item) => (
        <AlbumCard
          album={item}
          onPress={() => openAlbum(item)}
          fill
          downloadStatus={albumDownloadStatus(downloadStatuses, item)}
        />
      )}
      renderListItem={(item) => (
        <MediaRow
          imageType="album"
          mbid={item.mbid}
          coverUrl={item.coverUrl}
          title={item.albumName}
          subtitle={releaseYear(item.releaseDate)?.toString()}
          trailing={<SavedMark kind="album" id={albumSavedId(item)} />}
          onPress={() => openAlbum(item)}
        />
      )}
      keyExtractor={(item) => item.id}
    />
  );
}
