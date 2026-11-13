import { useCallback } from "react";
import { useRouter } from "expo-router";
import { AlbumCard } from "@/components/library/AlbumCard";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { MediaRow } from "@/components/ui/MediaRow";
import { SEARCH_PLACEHOLDERS } from "@/constants/navigation";
import { useAlbumGrid } from "@/hooks/library/use-album-grid";
import { albumRouteParams } from "@/lib/library-read";
import type { Album } from "@/lib/types/library";

/**
 * Every album in the library, or in one genre. No download statuses: the
 * read would cover every page loaded, up to the whole library.
 */
export function LibraryAlbumsScreen({ genre }: { genre?: string }) {
  const grid = useAlbumGrid({ genre });
  const router = useRouter();

  // A bare path, so expo-router resolves it inside the current tab group.
  const openAlbum = useCallback(
    (album: Album) => {
      router.push({
        pathname: "/album/[ref]",
        params: albumRouteParams(album, undefined, album.artistMbid),
      });
    },
    [router],
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
      searchQuery={grid.settledQuery}
      onSearchChange={grid.setSearchQuery}
      searchPlaceholder={SEARCH_PLACEHOLDERS.albums}
      hasUnderlyingItems={grid.hasUnderlyingItems}
      emptyMessage="No albums to show"
      viewModeKey="library-albums"
      onEndReached={grid.loadMore}
      isFetchingNextPage={grid.isFetchingNextPage}
      renderItem={(item) => (
        <AlbumCard
          album={item}
          onPress={() => openAlbum(item)}
          fill
          showArtist
        />
      )}
      renderListItem={(item) => (
        <MediaRow
          imageType="album"
          mbid={item.mbid}
          coverUrl={item.coverUrl}
          title={item.albumName}
          subtitle={item.artistName || "Unknown Artist"}
          onPress={() => openAlbum(item)}
        />
      )}
      keyExtractor={(item) => item.id}
    />
  );
}
