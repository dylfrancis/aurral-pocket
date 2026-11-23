import { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { useItemActions } from "@/components/actions/item-actions-context";
import {
  libraryAlbumTarget,
  savedAlbumTarget,
} from "@/components/actions/targets";
import { AlbumCard } from "@/components/library/AlbumCard";
import { SAVED_ALBUM_SORT_OPTIONS } from "@/components/library/AlbumSortPicker";
import { statusSection } from "@/components/library/LibraryListMenus";
import { ListPlayRow } from "@/components/library/ListPlayRow";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { MediaRow } from "@/components/ui/MediaRow";
import { menuOptionSection } from "@/components/ui/MenuOptions";
import { SavedMark, albumSavedId } from "@/components/offline/SavedMark";
import { SEARCH_PLACEHOLDERS } from "@/constants/navigation";
import { useAlbumGrid } from "@/hooks/library/use-album-grid";
import {
  readFirstSongs,
  readShuffleSongs,
  songListContext,
  usePlayLibrarySongs,
} from "@/hooks/library/use-play-library-songs";
import {
  offeredSort,
  type LibraryShow,
} from "@/hooks/library/use-library-view";
import { useSavedAlbums } from "@/hooks/offline/use-saved-albums";
import { albumRouteParams } from "@/lib/library-read";
import { useIsOffline } from "@/lib/offline/network";
import { savedAlbumRoute } from "@/lib/offline/saved-routes";
import type { Album } from "@/lib/types/library";

/**
 * Every album in the library, or in one genre. No download statuses: the
 * read would cover every page loaded, up to the whole library.
 *
 * The whole library can show only what's saved on the phone, and does by
 * itself with no connection. A genre can't: a save doesn't keep its genres.
 * Saved albums are sorted on the phone, so they take fewer sorts and no
 * status.
 */
export function LibraryAlbumsScreen({
  genre,
  openedSort,
}: {
  genre?: string;
  /** The sort a Library home rail opened the list on. */
  openedSort?: string;
}) {
  const grid = useAlbumGrid({ genre, openedSort });
  const router = useRouter();
  const isOffline = useIsOffline();
  const canShowSaved = !genre;
  const showSaved = canShowSaved && (isOffline || grid.show === "saved");
  const savedSort = offeredSort(SAVED_ALBUM_SORT_OPTIONS, grid.sortMode);
  const savedAlbums = useSavedAlbums(grid.typedQuery, savedSort);

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
  const { openAlbum: openActions } = useItemActions();
  const openAlbumActions = useCallback(
    (album: Album) => {
      const save = showSaved ? savedAlbums.savedAlbumFor(album) : undefined;
      openActions(save ? savedAlbumTarget(save) : libraryAlbumTarget(album));
    },
    [openActions, showSaved, savedAlbums],
  );
  const { readAndPlay, isLoading: songsLoading } = usePlayLibrarySongs();
  const genreHeader = useMemo(
    () =>
      genre ? (
        <ListPlayRow
          title={genre}
          disabled={songsLoading || isOffline}
          onPlay={() =>
            void readAndPlay(
              () => readFirstSongs({ genre }, "artist"),
              songListContext(genre),
            )
          }
          onShuffle={() =>
            void readAndPlay(
              () => readShuffleSongs({ genre }),
              songListContext(genre),
              { shuffled: true },
            )
          }
        />
      ) : undefined,
    [genre, songsLoading, isOffline, readAndPlay],
  );

  // A saved card is keyed by its save.
  const savedIdOf = (album: Album) =>
    showSaved ? album.id : albumSavedId(album);

  const { setShow, setStatus } = grid;
  const filterSections = useMemo(
    () => ({
      show: menuOptionSection<LibraryShow>(
        "Show",
        [
          // Offline, the server's lists can't load.
          { key: "all", label: "All Albums", disabled: isOffline },
          { key: "favorites", label: "Favorites", disabled: isOffline },
          ...(canShowSaved
            ? [{ key: "saved" as const, label: "Saved Offline" }]
            : []),
        ],
        showSaved ? "saved" : grid.show,
        setShow,
      ),
      status: statusSection(grid.status, setStatus, { disabled: showSaved }),
    }),
    [
      canShowSaved,
      isOffline,
      showSaved,
      grid.show,
      grid.status,
      setShow,
      setStatus,
    ],
  );

  return (
    <ReleaseGrid
      items={showSaved ? savedAlbums.albums : grid.items}
      isLoading={showSaved ? false : grid.isLoading}
      refreshing={showSaved ? false : grid.refreshing}
      onRefresh={grid.handleRefresh}
      sortMode={showSaved ? savedSort : grid.sortMode}
      onSortChange={grid.setSortMode}
      sortOptions={showSaved ? SAVED_ALBUM_SORT_OPTIONS : grid.sortOptions}
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
      filterSections={filterSections}
      filtered={showSaved || grid.show !== "all" || grid.status !== null}
      header={genreHeader}
      renderItem={(item) => (
        <AlbumCard
          album={item}
          onPress={() => openAlbum(item)}
          onLongPress={() => openAlbumActions(item)}
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
          onLongPress={() => openAlbumActions(item)}
        />
      )}
      keyExtractor={(item) => item.id}
    />
  );
}
