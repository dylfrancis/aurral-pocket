import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { FAVORITE_SORT_OPTIONS } from "@/components/library/AlbumSortPicker";
import { EmptyState } from "@/components/library/EmptyState";
import { sortMenu } from "@/components/library/LibraryListMenus";
import { NO_SCROLL_ANCHOR } from "@/components/library/ReleaseGrid";
import { SongRow } from "@/components/library/SongRow";
import {
  TrackActionsSheet,
  useTrackActions,
} from "@/components/library/TrackActionsSheet";
import { ListPlayRow } from "@/components/library/ListPlayRow";
import { CircleButton } from "@/components/ui/CircleButton";
import { MediaRow } from "@/components/ui/MediaRow";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { Text } from "@/components/ui/Text";
import {
  useLibraryFavorites,
  useToggleFavorite,
} from "@/hooks/library/use-library-favorites";
import {
  useLibraryView,
  type LibraryShow,
} from "@/hooks/library/use-library-view";
import {
  albumTrackArtist,
  albumTrackContext,
} from "@/hooks/library/album-track-context";
import { usePlayTrack } from "@/hooks/library/use-play-track";
import {
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

export default function LibraryFavoritesScreen() {
  const router = useRouter();
  const openArtist = useOpenArtist();
  const queryClient = useQueryClient();
  const colors = useColors();
  const { view, setSort } = useLibraryView(
    "library-favorites",
    FAVORITE_SORTS,
    FAVORITE_SHOWS,
  );
  const { data: favorites, refetch } = useLibraryFavorites(view.sort);
  // Recently Played and Most Played leave out what hasn't been played.
  const playedOnly = view.sort === "played" || view.sort === "plays";
  const toggleFavorite = useToggleFavorite();
  const trackActions = useTrackActions();
  const play = usePlayTrack();
  const { playSongs } = usePlayLibrarySongs();

  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const shown = useMemo(
    () => matchingFavorites(favorites, trimmedQuery),
    [favorites, trimmedQuery],
  );
  const rows = useMemo(() => favoriteRows(shown), [shown]);
  // Stable, because a header rebuild can drop the Android search icon.
  const handleSearchChange = useCallback(
    (event: { nativeEvent: { text: string } }) =>
      setSearchQuery(event.nativeEvent.text),
    [],
  );
  const handleSearchCancel = useCallback(() => setSearchQuery(""), []);
  const toolbar = useMemo(
    () => (
      <Stack.Toolbar placement="right">
        {sortMenu(FAVORITE_SORT_OPTIONS, view.sort, setSort)}
      </Stack.Toolbar>
    ),
    [view.sort, setSort],
  );

  const { refreshing, onRefresh } = usePullToRefresh(
    refetch,
    "Couldn't refresh favorites",
  );

  const renderRemoveButton = (
    kind: "artist" | "album",
    name: string,
    identityKey?: string,
  ) => (
    <CircleButton
      icon="heart"
      size={ROW_HEART_SIZE}
      accessibilityLabel={`Remove ${name} from favorites`}
      onPress={() => {
        if (!identityKey) return;
        toggleFavorite.mutate({ kind, key: identityKey, starred: false });
      }}
    />
  );

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
            onPress={() =>
              router.push({
                pathname: "/album/[ref]",
                params: albumRouteParams(
                  row.album,
                  undefined,
                  row.album.artistMbid,
                ),
              })
            }
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
        key={view.sort}
        maintainVisibleContentPosition={NO_SCROLL_ANCHOR}
        data={rows}
        renderItem={renderRow}
        keyExtractor={rowKey}
        getItemType={(row) => row.type}
        ListHeaderComponent={
          shown.tracks.length > 0 ? (
            <ListPlayRow
              title="Favorites"
              onPlay={() => void playSongs(shown.tracks, FAVORITES)}
              onShuffle={() =>
                void playSongs(shown.tracks, FAVORITES, { shuffled: true })
              }
            />
          ) : null
        }
        ListEmptyComponent={
          trimmedQuery ? (
            <EmptyState
              icon="search-outline"
              message={`No results matching “${trimmedQuery}”`}
            />
          ) : playedOnly ? (
            <EmptyState
              icon="heart-outline"
              message="You haven't played any of your favorites yet"
            />
          ) : (
            <EmptyState
              icon="heart-outline"
              message="Add albums and tracks to your favorites to find them here"
            />
          )
        }
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
      />
      <TrackActionsSheet
        target={trackActions.target}
        onClose={trackActions.close}
      />
    </>
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load favorites" />;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
});
