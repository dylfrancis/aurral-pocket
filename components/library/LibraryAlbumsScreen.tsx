import { useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { AlbumCard } from "@/components/library/AlbumCard";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { MediaRow } from "@/components/ui/MediaRow";
import { showMenuSection } from "@/components/ui/ShowMenuSection";
import { SavedMark, albumSavedId } from "@/components/offline/SavedMark";
import { SEARCH_PLACEHOLDERS } from "@/constants/navigation";
import { useAlbumGrid } from "@/hooks/library/use-album-grid";
import { useSavedAlbums } from "@/hooks/offline/use-saved-albums";
import { albumRouteParams } from "@/lib/library-read";
import { useIsOffline } from "@/lib/offline/network";
import { savedAlbumRoute } from "@/lib/offline/saved-routes";
import type { Album } from "@/lib/types/library";

type Show = "all" | "saved";

/**
 * Every album in the library, or in one genre. No download statuses: the
 * read would cover every page loaded, up to the whole library.
 *
 * The whole library can show only what's saved on the phone, and does by
 * itself with no connection. A genre can't: a save doesn't keep its genres.
 */
export function LibraryAlbumsScreen({ genre }: { genre?: string }) {
  const grid = useAlbumGrid({ genre });
  const router = useRouter();
  const isOffline = useIsOffline();
  const [picked, setPicked] = useState<Show>("all");
  const canShowSaved = !genre;
  const showSaved = canShowSaved && (isOffline || picked === "saved");
  const savedAlbums = useSavedAlbums(grid.typedQuery, grid.sortMode);

  // A bare path, so expo-router resolves it inside the current tab group.
  const openAlbum = useCallback(
    (album: Album) => {
      const save = showSaved ? savedAlbums.savedAlbumFor(album) : undefined;
      router.push(
        save
          ? savedAlbumRoute(save)
          : {
              pathname: "/album/[ref]",
              params: albumRouteParams(album, undefined, album.artistMbid),
            },
      );
    },
    [router, showSaved, savedAlbums],
  );
  // A saved card is keyed by its save.
  const savedIdOf = (album: Album) =>
    showSaved ? album.id : albumSavedId(album);

  const showSection = useMemo(
    () =>
      canShowSaved
        ? showMenuSection<Show>(
            [
              // Offline, the server's list can't load.
              { key: "all", label: "All Albums", disabled: isOffline },
              { key: "saved", label: "Saved Offline" },
            ],
            showSaved ? "saved" : "all",
            setPicked,
          )
        : undefined,
    [canShowSaved, isOffline, showSaved],
  );

  return (
    <ReleaseGrid
      items={showSaved ? savedAlbums.albums : grid.items}
      isLoading={showSaved ? false : grid.isLoading}
      refreshing={showSaved ? false : grid.refreshing}
      onRefresh={grid.handleRefresh}
      sortMode={grid.sortMode}
      onSortChange={grid.setSortMode}
      sortOptions={grid.sortOptions}
      searchQuery={showSaved ? grid.typedQuery : grid.settledQuery}
      onSearchChange={grid.setSearchQuery}
      searchPlaceholder={SEARCH_PLACEHOLDERS.albums}
      hasUnderlyingItems={
        showSaved ? savedAlbums.hasSaves : grid.hasUnderlyingItems
      }
      emptyMessage={showSaved ? "No albums saved offline" : "No albums to show"}
      emptyIcon={showSaved ? "arrow-down-circle-outline" : undefined}
      viewModeKey="library-albums"
      onEndReached={showSaved ? undefined : grid.loadMore}
      isFetchingNextPage={showSaved ? false : grid.isFetchingNextPage}
      showSection={showSection}
      renderItem={(item) => (
        <AlbumCard
          album={item}
          onPress={() => openAlbum(item)}
          fill
          showArtist
          savedId={savedIdOf(item)}
        />
      )}
      renderListItem={(item) => (
        <MediaRow
          imageType="album"
          mbid={item.mbid}
          coverUrl={item.coverUrl}
          title={item.albumName}
          subtitle={item.artistName || "Unknown Artist"}
          trailing={<SavedMark kind="album" id={savedIdOf(item)} />}
          onPress={() => openAlbum(item)}
        />
      )}
      keyExtractor={(item) => item.id}
    />
  );
}
