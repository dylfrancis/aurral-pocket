import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { EmptyState } from "@/components/library/EmptyState";
import {
  TrackActionsSheet,
  useTrackActions,
} from "@/components/library/TrackActionsSheet";
import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { CircleButton } from "@/components/ui/CircleButton";
import { MediaRow } from "@/components/ui/MediaRow";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { Text } from "@/components/ui/Text";
import {
  useLibraryFavorites,
  useToggleFavorite,
} from "@/hooks/library/use-library-favorites";
import { coverArtUrlFrom } from "@/hooks/library/use-cover-art-url";
import { usePlayTrack } from "@/hooks/library/use-play-track";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { searchBarColors } from "@/constants/navigation";
import { Colors } from "@/constants/theme";
import { albumRouteParams, artistRouteId } from "@/lib/library-read";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import { libraryKeys } from "@/lib/query-keys";
import type {
  Album,
  Artist,
  CoverArtResponse,
  FavoriteTrack,
  LibraryFavorites,
} from "@/lib/types/library";

const ROW_HEART_SIZE = 40;

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

function favoriteRows(favorites: LibraryFavorites): FavoriteRow[] {
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

const trackArtistName = (track: FavoriteTrack) =>
  track.artistName || track.album?.artistName || "";

function matchingFavorites(
  favorites: LibraryFavorites,
  query: string,
): LibraryFavorites {
  if (!query) return favorites;
  const lowerCaseQuery = query.toLocaleLowerCase();
  const matches = (...fields: (string | undefined)[]) =>
    fields.some((field) => field?.toLocaleLowerCase().includes(lowerCaseQuery));
  return {
    artists: favorites.artists.filter((artist) => matches(artist.artistName)),
    albums: favorites.albums.filter((album) =>
      matches(album.albumName, album.artistName),
    ),
    tracks: favorites.tracks.filter((track) =>
      matches(track.trackName, trackArtistName(track), track.album?.albumName),
    ),
  };
}

/**
 * Built at tap time, because the artwork fallback is whatever the row's
 * thumbnail lookup found. The list sends no lookups of its own.
 */
function playerContext(
  track: FavoriteTrack,
  queryClient: QueryClient,
): PlayerAlbumContext {
  const albumMbid = track.album?.mbid || null;
  return {
    albumTitle: track.album?.albumName ?? "",
    artistName: trackArtistName(track),
    coverPath: track.album?.coverUrl ?? null,
    artworkUrl: albumMbid
      ? coverArtUrlFrom(
          queryClient.getQueryData<CoverArtResponse>(
            libraryKeys.albumCover(albumMbid),
          ),
        )
      : null,
    albumMbid,
    artistMbid: track.album?.artistMbid ?? null,
    albumRef: track.album ? albumRouteParams(track.album).ref : null,
  };
}

export default function LibraryFavoritesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = Colors[useColorScheme()];
  const { data: favorites, refetch } = useLibraryFavorites();
  const toggleFavorite = useToggleFavorite();
  const trackActions = useTrackActions();
  const play = usePlayTrack();

  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const rows = useMemo(
    () => favoriteRows(matchingFavorites(favorites, trimmedQuery)),
    [favorites, trimmedQuery],
  );
  // Stable, because a header rebuild can drop the Android search icon.
  const handleSearchChange = useCallback(
    (event: { nativeEvent: { text: string } }) =>
      setSearchQuery(event.nativeEvent.text),
    [],
  );
  const handleSearchCancel = useCallback(() => setSearchQuery(""), []);

  // Its own flag, not isRefetching, so a refetch nobody pulled for shows no
  // spinner.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const result = await refetch();
    setRefreshing(false);
    if (result.isError) {
      Burnt.toast({ title: "Couldn't refresh favorites", preset: "error" });
    }
  }, [refetch]);

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
        toggleFavorite.mutate({ kind, identityKey, starred: false });
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
              router.push({
                pathname: "/artist/[mbid]",
                params: {
                  mbid: artistRouteId(row.artist),
                  name: row.artist.artistName,
                },
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
        const openActions = () =>
          trackActions.open(track, playerContext(track, queryClient));
        return (
          <MediaRow
            imageType="album"
            mbid={track.album?.mbid}
            coverUrl={track.album?.coverUrl}
            title={track.trackName}
            subtitle={[trackArtistName(track), track.album?.albumName]
              .filter(Boolean)
              .join(" · ")}
            showChevron={false}
            trailing={
              <TrackMenuButton
                trackName={track.trackName}
                onPress={openActions}
              />
            }
            onPress={() =>
              void play([track], track, playerContext(track, queryClient))
            }
            onLongPress={openActions}
          />
        );
      }
    }
  };

  return (
    <>
      <Stack.SearchBar
        placeholder="Search favorites"
        hideWhenScrolling={false}
        autoCapitalize="none"
        {...searchBarColors(colors)}
        onChangeText={handleSearchChange}
        onCancelButtonPress={handleSearchCancel}
      />
      <FlashList
        data={rows}
        renderItem={renderRow}
        keyExtractor={rowKey}
        getItemType={(row) => row.type}
        ListEmptyComponent={
          trimmedQuery ? (
            <EmptyState
              icon="search-outline"
              message={`No results matching “${trimmedQuery}”`}
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
            onRefresh={handleRefresh}
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
