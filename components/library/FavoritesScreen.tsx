import { useCallback, useMemo, useState, type ReactElement } from "react";
import {
  RefreshControl,
  StyleSheet,
  type RefreshControlProps,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useItemActions } from "@/components/actions/item-actions-context";
import {
  libraryAlbumTarget,
  savedAlbumTarget,
} from "@/components/actions/targets";
import {
  FAVORITE_SORT_OPTIONS,
  type LibrarySongSortMode,
} from "@/components/library/AlbumSortPicker";
import { EmptyState } from "@/components/library/EmptyState";
import { sortMenu } from "@/components/library/LibraryListMenus";
import { NO_SCROLL_ANCHOR } from "@/components/library/ReleaseGrid";
import { SongRow } from "@/components/library/SongRow";
import {
  TrackActionsSheet,
  useTrackActions,
} from "@/components/library/TrackActionsSheet";
import { ListPlayRow } from "@/components/library/ListPlayRow";
import { favoritesSaveMenu } from "@/components/offline/favorites-save-menu";
import { CircleButton } from "@/components/ui/CircleButton";
import { MediaRow } from "@/components/ui/MediaRow";
import { Text } from "@/components/ui/Text";
import {
  useLibraryFavorites,
  useToggleFavorite,
} from "@/hooks/library/use-library-favorites";
import {
  offeredSort,
  useLibraryView,
  type LibraryShow,
} from "@/hooks/library/use-library-view";
import {
  albumTrackArtist,
  albumTrackContext,
} from "@/hooks/library/album-track-context";
import { usePlayTrack } from "@/hooks/library/use-play-track";
import {
  readAlbumsSongs,
  songListContext,
  usePlayLibrarySongs,
} from "@/hooks/library/use-play-library-songs";
import { SEARCH_PLACEHOLDERS, headerSearchBar } from "@/constants/navigation";
import { albumRouteParams, artistRouteId } from "@/lib/library-read";
import type {
  Album,
  Artist,
  FavoriteLists,
  FavoriteTrack,
} from "@/lib/types/library";
import { useFavoritesSaveChoice } from "@/hooks/offline/use-favorites-save";
import {
  SAVED_FAVORITE_SORT_OPTIONS,
  useSavedFavorites,
} from "@/hooks/offline/use-saved-favorites";
import { progressLine } from "@/lib/offline/format";
import { useIsOffline } from "@/lib/offline/network";
import { savedAlbumRoute } from "@/lib/offline/saved-routes";
import {
  retryFavorites,
  useFavoritesStatus,
} from "@/lib/offline/saved-library";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { useColors } from "@/hooks/use-colors";

const ROW_HEART_SIZE = 40;
const FAVORITES = songListContext("Favorites");
const FAVORITE_SORTS = FAVORITE_SORT_OPTIONS.map((option) => option.key);
// Favorites has no Show filter.
const FAVORITE_SHOWS: LibraryShow[] = ["all"];

type FavoriteRow =
  | { type: "header"; title: string }
  | { type: "artist"; artist: Artist }
  | { type: "album"; album: Album }
  | { type: "track"; track: FavoriteTrack };

function sectionRows<Item>(
  title: string,
  items: Item[],
  toRow: (item: Item) => FavoriteRow,
): FavoriteRow[] {
  return items.length > 0
    ? [{ type: "header", title }, ...items.map(toRow)]
    : [];
}

function favoriteRows(favorites: FavoriteLists): FavoriteRow[] {
  return [
    ...sectionRows("Artists", favorites.artists, (artist) => ({
      type: "artist",
      artist,
    })),
    ...sectionRows("Albums", favorites.albums, (album) => ({
      type: "album",
      album,
    })),
    ...sectionRows("Tracks", favorites.tracks, (track) => ({
      type: "track",
      track,
    })),
  ];
}

function rowKey(row: FavoriteRow) {
  switch (row.type) {
    case "header":
      return row.title;
    case "artist":
      return `artist:${row.artist.id}`;
    case "album":
      return `album:${row.album.id}`;
    case "track":
      return `track:${row.track.id}`;
  }
}

function matchingFavorites(
  favorites: FavoriteLists,
  query: string,
): FavoriteLists {
  if (!query) return favorites;
  const lowerCaseQuery = query.toLocaleLowerCase();
  const matches = (...fields: (string | undefined)[]) =>
    fields.some((field) => field?.toLocaleLowerCase().includes(lowerCaseQuery));
  return {
    ...favorites,
    artists: favorites.artists.filter((artist) => matches(artist.artistName)),
    albums: favorites.albums.filter((album) =>
      matches(album.albumName, album.artistName),
    ),
    tracks: favorites.tracks.filter((track) =>
      matches(track.trackName, albumTrackArtist(track), track.album?.albumName),
    ),
  };
}

/**
 * Favorites from the server, or with no connection, the favorites Favorites
 * keeps on the phone, as a saved playlist opens offline.
 */
export function FavoritesScreen() {
  const isOffline = useIsOffline();
  const { view, setSort } = useLibraryView(
    "library-favorites",
    FAVORITE_SORTS,
    FAVORITE_SHOWS,
  );
  return isOffline ? (
    <SavedFavorites sort={view.sort} onSort={setSort} />
  ) : (
    <ServerFavorites sort={view.sort} onSort={setSort} />
  );
}

/** One Library artist's favorite albums and songs, by its canonical id. */
export function ArtistFavoritesScreen({ artistId }: { artistId: string }) {
  const { view, setSort } = useLibraryView(
    "artist-favorites",
    FAVORITE_SORTS,
    FAVORITE_SHOWS,
  );
  return (
    <ServerFavorites sort={view.sort} onSort={setSort} artistId={artistId} />
  );
}

type SortProps = {
  sort: LibrarySongSortMode;
  onSort: (sort: LibrarySongSortMode) => void;
};

function ServerFavorites({
  sort,
  onSort,
  artistId,
}: SortProps & { artistId?: string }) {
  const router = useRouter();
  const itemActions = useItemActions();
  const colors = useColors();
  const { data: favorites, refetch } = useLibraryFavorites(sort, artistId);
  const { refreshing, onRefresh } = usePullToRefresh(
    refetch,
    "Couldn't refresh favorites",
  );
  // Recently Played and Most Played leave out what hasn't been played.
  const playedOnly = sort === "played" || sort === "plays";
  return (
    <FavoritesList
      favorites={favorites}
      sortOptions={FAVORITE_SORT_OPTIONS}
      sort={sort}
      onSort={onSort}
      canUnfavorite
      canSave={!artistId}
      canPlayAlbums
      openAlbum={(album) =>
        router.push({
          pathname: "/album/[ref]",
          params: albumRouteParams(album, undefined, album.artistMbid),
        })
      }
      openAlbumActions={(album) =>
        itemActions.openAlbum(libraryAlbumTarget(album))
      }
      emptyMessage={
        playedOnly
          ? "You haven't played any of your favorites yet"
          : artistId
            ? "No favorite albums or tracks by this artist"
            : "Add albums and tracks to your favorites to find them here"
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand}
        />
      }
    />
  );
}

/** The favorites kept on the phone, with only the sorts the phone can do. */
function SavedFavorites({ sort, onSort }: SortProps) {
  const router = useRouter();
  const itemActions = useItemActions();
  const savedSort = offeredSort(SAVED_FAVORITE_SORT_OPTIONS, sort);
  const { lists, savedAlbumFor } = useSavedFavorites(savedSort);
  const keepsFavorites = useFavoritesStatus() !== null;
  return (
    <FavoritesList
      favorites={lists}
      sortOptions={SAVED_FAVORITE_SORT_OPTIONS}
      sort={savedSort}
      onSort={onSort}
      canUnfavorite={false}
      canSave
      canPlayAlbums={false}
      openAlbum={(album) => {
        const save = savedAlbumFor(album);
        if (save) router.push(savedAlbumRoute(save));
      }}
      openAlbumActions={(album) => {
        const save = savedAlbumFor(album);
        if (save) itemActions.openAlbum(savedAlbumTarget(save));
      }}
      emptyMessage={
        keepsFavorites
          ? "None of your favorites are on this phone yet"
          : "Save your favorites to this phone to play them without a connection"
      }
    />
  );
}

function FavoritesList({
  favorites,
  sortOptions,
  sort,
  onSort,
  canUnfavorite,
  canSave,
  canPlayAlbums,
  openAlbum,
  openAlbumActions,
  emptyMessage,
  refreshControl,
}: {
  favorites: FavoriteLists;
  sortOptions: readonly (typeof FAVORITE_SORT_OPTIONS)[number][];
  sort: LibrarySongSortMode;
  onSort: (sort: LibrarySongSortMode) => void;
  /** Hearts need the server, so a list from the phone has none. */
  canUnfavorite: boolean;
  /** Saving keeps every favorite, so one artist's list doesn't offer it. */
  canSave: boolean;
  /** With no favorite songs, Play reads the albums' songs from the server. */
  canPlayAlbums: boolean;
  openAlbum: (album: Album) => void;
  openAlbumActions: (album: Album) => void;
  emptyMessage: string;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const openArtist = useOpenArtist();
  const itemActions = useItemActions();
  const queryClient = useQueryClient();
  const colors = useColors();
  const toggleFavorite = useToggleFavorite();
  const trackActions = useTrackActions();
  const play = usePlayTrack();
  const {
    playSongs,
    readAndPlay,
    isLoading: isReadingAlbums,
  } = usePlayLibrarySongs();

  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const shown = useMemo(
    () => matchingFavorites(favorites, trimmedQuery),
    [favorites, trimmedQuery],
  );
  const rows = useMemo(() => favoriteRows(shown), [shown]);
  const playAlbums = (shuffled: boolean) =>
    void readAndPlay(
      () => readAlbumsSongs(shown.albums, queryClient),
      FAVORITES,
      { shuffled },
    );
  // Stable, because a header rebuild can drop the Android search icon.
  const handleSearchChange = useCallback(
    (event: { nativeEvent: { text: string } }) =>
      setSearchQuery(event.nativeEvent.text),
    [],
  );
  const handleSearchCancel = useCallback(() => setSearchQuery(""), []);
  const saveStatus = useFavoritesStatus();
  const { choose: chooseSave } = useFavoritesSaveChoice();
  const saveLine = canSave ? progressLine(saveStatus) : null;
  // Only these, so the toolbar isn't rebuilt with every file saved.
  const saveMode = saveStatus?.mode ?? null;
  const saveState = saveStatus?.state ?? null;
  const toolbar = useMemo(
    () => (
      <Stack.Toolbar placement="right">
        {canSave
          ? favoritesSaveMenu({
              mode: saveMode,
              state: saveState,
              onChoose: chooseSave,
              onRetry: retryFavorites,
            })
          : null}
        {sortMenu(sortOptions, sort, onSort)}
      </Stack.Toolbar>
    ),
    [sortOptions, sort, onSort, canSave, saveMode, saveState, chooseSave],
  );

  const renderRemoveButton = (
    kind: "artist" | "album",
    name: string,
    identityKey?: string,
  ) =>
    canUnfavorite ? (
      <CircleButton
        icon="heart"
        size={ROW_HEART_SIZE}
        accessibilityLabel={`Remove ${name} from favorites`}
        onPress={() => {
          if (!identityKey) return;
          toggleFavorite.mutate({ kind, key: identityKey, starred: false });
        }}
      />
    ) : undefined;

  const renderRow = ({ item: row }: { item: FavoriteRow }) => {
    switch (row.type) {
      case "header":
        return (
          <Text
            variant="subtitle"
            accessibilityRole="header"
            style={[styles.header, { color: colors.text }]}
          >
            {row.title}
          </Text>
        );
      case "artist":
        return (
          <MediaRow
            imageType="artist"
            mbid={row.artist.mbid}
            coverUrl={row.artist.coverUrl}
            title={row.artist.artistName}
            trailing={renderRemoveButton(
              "artist",
              row.artist.artistName,
              row.artist.identityKey,
            )}
            onPress={() =>
              openArtist({
                mbid: artistRouteId(row.artist),
                name: row.artist.artistName,
              })
            }
            onLongPress={() =>
              itemActions.openArtist({
                ref: artistRouteId(row.artist),
                name: row.artist.artistName,
                coverUrl: row.artist.coverUrl,
              })
            }
          />
        );
      case "album":
        return (
          <MediaRow
            imageType="album"
            mbid={row.album.mbid}
            coverUrl={row.album.coverUrl}
            title={row.album.albumName}
            subtitle={row.album.artistName}
            trailing={renderRemoveButton(
              "album",
              row.album.albumName,
              row.album.identityKey,
            )}
            onPress={() => openAlbum(row.album)}
            onLongPress={() => openAlbumActions(row.album)}
          />
        );
      case "track": {
        const { track } = row;
        return (
          <SongRow
            track={track}
            onPress={() =>
              void play([track], track, albumTrackContext(track, queryClient))
            }
            onOpenActions={() =>
              trackActions.open(track, albumTrackContext(track, queryClient))
            }
          />
        );
      }
    }
  };

  return (
    <>
      <Stack.SearchBar
        {...headerSearchBar(SEARCH_PLACEHOLDERS.favorites, colors)}
        onChangeText={handleSearchChange}
        onCancelButtonPress={handleSearchCancel}
      />
      {toolbar}
      <FlashList
        // A new sort opens at the top; see NO_SCROLL_ANCHOR.
        key={sort}
        maintainVisibleContentPosition={NO_SCROLL_ANCHOR}
        data={rows}
        renderItem={renderRow}
        keyExtractor={rowKey}
        getItemType={(row) => row.type}
        ListHeaderComponent={
          <>
            {shown.tracks.length > 0 ? (
              <ListPlayRow
                title="Favorites"
                onPlay={() =>
                  void playSongs(shown.tracks, FAVORITES, { shuffled: false })
                }
                onShuffle={() =>
                  void playSongs(shown.tracks, FAVORITES, { shuffled: true })
                }
              />
            ) : canPlayAlbums && shown.albums.length > 0 ? (
              <ListPlayRow
                title="Favorites"
                disabled={isReadingAlbums}
                onPlay={() => playAlbums(false)}
                onShuffle={() => playAlbums(true)}
              />
            ) : null}
            {saveLine ? (
              <Text
                variant="caption"
                style={[styles.saveLine, { color: colors.subtle }]}
              >
                {saveLine}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          trimmedQuery ? (
            <EmptyState
              icon="search-outline"
              message={`No results matching “${trimmedQuery}”`}
            />
          ) : (
            <EmptyState icon="heart-outline" message={emptyMessage} />
          )
        }
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ backgroundColor: colors.background }}
        refreshControl={refreshControl}
      />
      <TrackActionsSheet
        target={trackActions.target}
        onClose={trackActions.close}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // As the Offline screen's total sits under its play row.
  saveLine: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
});
