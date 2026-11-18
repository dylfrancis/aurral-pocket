import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
  type ErrorBoundaryProps,
} from "expo-router";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import Public from "@expo/material-symbols/public.xml";
import Star from "@expo/material-symbols/star.xml";
import Group from "@expo/material-symbols/group.xml";
import Album from "@expo/material-symbols/album.xml";
import MusicNote from "@expo/material-symbols/music_note.xml";
import QueueMusic from "@expo/material-symbols/queue_music.xml";
import { SearchArtistRow } from "@/components/search/SearchArtistRow";
import { SearchAlbumRow } from "@/components/search/SearchAlbumRow";
import { SearchAlbumCard } from "@/components/search/SearchAlbumCard";
import { SearchSongRow } from "@/components/search/SearchSongRow";
import {
  SearchPlaylistRow,
  searchPlaylistHref,
  searchPlaylistKey,
} from "@/components/search/SearchPlaylistRow";
import { TrackActionsSheet } from "@/components/library/TrackActionsSheet";
import { TagArtistRow } from "@/components/search/TagArtistRow";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonRows } from "@/components/search/SkeletonRows";
import { Text } from "@/components/ui/Text";
import { HorizontalArtistCard } from "@/components/discover/HorizontalArtistCard";
import { GridCell, gridListStyles } from "@/components/ui/GridCell";
import {
  FILTER_MENU_ICON,
  menuOptionActions,
  type MenuOption,
} from "@/components/ui/MenuOptions";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import { useAlbumSearch } from "@/hooks/search/use-album-search";
import { useArtistsByTag } from "@/hooks/search/use-artists-by-tag";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useLibraryAlbumLookup } from "@/hooks/search/use-library-album-lookup";
import { useLibrarySearch } from "@/hooks/search/use-library-search";
import { useSearchSongActions } from "@/hooks/search/use-search-song-actions";
import { useGridListView } from "@/hooks/use-grid-list-view";
import { Fonts } from "@/constants/theme";
import type {
  LibrarySearchPlaylist,
  LibrarySearchTrack,
  SearchAlbum,
  SearchArtist,
  TagArtist,
  TagSearchScope,
} from "@/lib/types/search";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { useColors } from "@/hooks/use-colors";

type ResultScope = "artist" | "album" | "song" | "playlist";

const RESULT_SCOPES: readonly ResultScope[] = [
  "artist",
  "album",
  "song",
  "playlist",
];

const SCOPE_OPTIONS: MenuOption<ResultScope>[] = [
  { key: "artist", label: "Artists", iosIcon: "person.2", androidIcon: Group },
  {
    key: "album",
    label: "Albums",
    iosIcon: "opticaldisc",
    androidIcon: Album,
  },
  {
    key: "song",
    label: "Songs",
    iosIcon: "music.note",
    androidIcon: MusicNote,
  },
  {
    key: "playlist",
    label: "Playlists",
    iosIcon: "music.note.list",
    androidIcon: QueueMusic,
  },
];

const TAG_SCOPE_OPTIONS: MenuOption<TagSearchScope>[] = [
  { key: "all", label: "All Artists", iosIcon: "globe", androidIcon: Public },
  {
    key: "recommended",
    label: "Recommended",
    iosIcon: "star",
    androidIcon: Star,
  },
];

export default function SearchResultsScreen() {
  const { q, scope: scopeParam } = useLocalSearchParams<{
    q: string;
    scope?: ResultScope;
  }>();
  const openArtist = useOpenArtist();
  const router = useRouter();
  const colors = useColors();

  const query = q ?? "";
  const isTagSearch = query.startsWith("#");
  const tagQuery = isTagSearch ? query.slice(1).trim() : "";

  const [tagScope, setTagScope] = useState<TagSearchScope>("recommended");
  const [resultScope, setResultScope] = useState<ResultScope>(
    scopeParam && RESULT_SCOPES.includes(scopeParam) ? scopeParam : "artist",
  );
  const isLibraryScope = resultScope === "song" || resultScope === "playlist";
  const { isGrid, numColumns, viewMenuSection } = useGridListView(
    "search-results",
    "list",
  );

  const {
    data: artistData,
    isLoading: artistLoading,
    refetch: refetchArtists,
  } = useArtistSearch(isTagSearch || resultScope !== "artist" ? "" : query);

  const {
    data: albumData,
    isLoading: albumLoading,
    refetch: refetchAlbums,
  } = useAlbumSearch(isTagSearch || resultScope !== "album" ? "" : query);

  // Asked in every scope: Search already holds this answer, so switching to
  // Songs or Playlists shows rows at once instead of an empty list.
  const {
    data: libraryData,
    isLoading: libraryLoading,
    refetch: refetchLibrary,
  } = useLibrarySearch(isTagSearch ? "" : query);

  const {
    data: tagData,
    isLoading: tagLoading,
    refetch: refetchTags,
  } = useArtistsByTag(
    isTagSearch && tagQuery.length >= 2 ? tagQuery : null,
    tagScope,
  );

  const refreshResults = useCallback(
    () =>
      isTagSearch
        ? refetchTags()
        : isLibraryScope
          ? refetchLibrary()
          : resultScope === "album"
            ? refetchAlbums()
            : refetchArtists(),
    [
      isTagSearch,
      isLibraryScope,
      resultScope,
      refetchTags,
      refetchLibrary,
      refetchAlbums,
      refetchArtists,
    ],
  );
  const { refreshing, onRefresh } = usePullToRefresh(refreshResults);

  const isLoading = isTagSearch
    ? tagLoading
    : isLibraryScope
      ? libraryLoading
      : resultScope === "album"
        ? albumLoading
        : artistLoading;

  const artists = artistData?.artists;
  const albums = albumData?.items;
  const songs = libraryData?.tracks;
  const playlists = libraryData?.playlists;
  const tagArtists = tagData?.recommendations;
  const { isInLibrary } = useLibraryLookup(
    (isTagSearch ? tagArtists : artists)?.map((artist) => artist.id) ?? [],
  );

  const fullData = isTagSearch
    ? tagArtists
    : resultScope === "song"
      ? songs
      : resultScope === "playlist"
        ? playlists
        : resultScope === "album"
          ? albums
          : artists;
  const resultCount = fullData?.length ?? 0;
  const showResults = fullData !== undefined && resultCount > 0;
  const showNoResults =
    !isLoading && fullData !== undefined && resultCount === 0;

  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({
      headerTitle: isTagSearch ? "Tag Results" : `Results for "${query}"`,
    });
  }, [navigation, isTagSearch, query]);

  const handleArtistPress = useCallback(
    (artist: SearchArtist | TagArtist) =>
      openArtist({ mbid: artist.id, name: artist.name }),
    [openArtist],
  );

  const { statusFor: albumStatusFor, openAlbum } = useLibraryAlbumLookup(
    albums ?? [],
  );

  const renderArtistItem = useCallback(
    ({ item }: { item: SearchArtist }) => (
      <SearchArtistRow
        artist={item}
        isInLibrary={isInLibrary(item.id)}
        onPress={() => handleArtistPress(item)}
      />
    ),
    [isInLibrary, handleArtistPress],
  );

  const renderAlbumItem = useCallback(
    ({ item }: { item: SearchAlbum }) => (
      <SearchAlbumRow
        album={item}
        status={albumStatusFor(item)}
        onPress={() => void openAlbum(item)}
      />
    ),
    [albumStatusFor, openAlbum],
  );

  const songActions = useSearchSongActions();
  const { play: playSong, openActions: openSongActions } = songActions;
  const renderSongItem = useCallback(
    ({ item }: { item: LibrarySearchTrack }) => (
      <SearchSongRow
        track={item}
        onPress={() => void playSong(item)}
        onOpenActions={() => openSongActions(item)}
      />
    ),
    [playSong, openSongActions],
  );

  const renderPlaylistItem = useCallback(
    ({ item }: { item: LibrarySearchPlaylist }) => (
      <SearchPlaylistRow
        playlist={item}
        onPress={() => router.push(searchPlaylistHref(item))}
      />
    ),
    [router],
  );

  const renderTagArtistItem = useCallback(
    ({ item }: { item: TagArtist }) => (
      <TagArtistRow
        artist={item}
        isInLibrary={isInLibrary(item.id)}
        onPress={() => handleArtistPress(item)}
      />
    ),
    [isInLibrary, handleArtistPress],
  );

  const renderArtistGridItem = useCallback(
    ({ item }: { item: SearchArtist | TagArtist }) => (
      <GridCell>
        <HorizontalArtistCard
          mbid={item.id}
          name={item.name}
          isInLibrary={isInLibrary(item.id)}
          fill
          onPress={() => handleArtistPress(item)}
        />
      </GridCell>
    ),
    [isInLibrary, handleArtistPress],
  );

  const renderAlbumGridItem = useCallback(
    ({ item }: { item: SearchAlbum }) => (
      <GridCell>
        <SearchAlbumCard album={item} onPress={() => void openAlbum(item)} />
      </GridCell>
    ),
    [openAlbum],
  );

  const tagScopeLabel = tagScope === "recommended" ? "Recommended" : "All";
  const tagListHeader = (
    <View>
      <Text
        variant="caption"
        style={[styles.subtitle, { color: colors.subtle }]}
      >
        {tagScopeLabel} artists for tag {`“${tagQuery}”`}
      </Text>
    </View>
  );

  const canBroadenToAll =
    isTagSearch && tagScope === "recommended" && showNoResults;
  // Song and playlist rows have square artwork, as album rows do.
  const skeletonVariant: "artist" | "album" =
    !isTagSearch && resultScope !== "artist" ? "album" : "artist";
  const emptyComponent = isLoading ? (
    <SkeletonRows count={8} variant={skeletonVariant} />
  ) : showNoResults ? (
    <EmptyState
      icon="search-outline"
      message={`No results found for “${query}”`}
      actionLabel={canBroadenToAll ? "Try searching all" : undefined}
      onAction={canBroadenToAll ? () => setTagScope("all") : undefined}
    />
  ) : null;

  const albumKeyExtractor = useMemo(() => (item: SearchAlbum) => item.id, []);
  const songKeyExtractor = useMemo(
    () => (item: LibrarySearchTrack) => item.id,
    [],
  );
  const playlistKeyExtractor = useMemo(() => searchPlaylistKey, []);
  const artistKeyExtractor = useMemo(
    () => (item: SearchArtist | TagArtist) => item.id,
    [],
  );

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon={FILTER_MENU_ICON} title="Scope">
          {isTagSearch
            ? menuOptionActions(TAG_SCOPE_OPTIONS, tagScope, setTagScope)
            : menuOptionActions(SCOPE_OPTIONS, resultScope, setResultScope)}
          {/* Songs and playlists are rows only. */}
          {(isTagSearch || !isLibraryScope) && viewMenuSection}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {isTagSearch ? (
        <FlashList
          key={`tag-${isGrid}`}
          data={showResults ? (tagArtists as TagArtist[]) : []}
          renderItem={isGrid ? renderArtistGridItem : renderTagArtistItem}
          keyExtractor={artistKeyExtractor}
          numColumns={numColumns}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={isGrid ? gridListStyles.grid : undefined}
          ListHeaderComponent={tagListHeader}
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : resultScope === "song" ? (
        <FlashList
          key="song"
          data={showResults ? (songs as LibrarySearchTrack[]) : []}
          renderItem={renderSongItem}
          keyExtractor={songKeyExtractor}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : resultScope === "playlist" ? (
        <FlashList
          key="playlist"
          data={showResults ? (playlists as LibrarySearchPlaylist[]) : []}
          renderItem={renderPlaylistItem}
          keyExtractor={playlistKeyExtractor}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : resultScope === "album" ? (
        <FlashList
          key={`album-${isGrid}`}
          data={showResults ? (albums as SearchAlbum[]) : []}
          renderItem={isGrid ? renderAlbumGridItem : renderAlbumItem}
          keyExtractor={albumKeyExtractor}
          numColumns={numColumns}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={isGrid ? gridListStyles.grid : undefined}
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <FlashList
          key={`artist-${isGrid}`}
          data={showResults ? (artists as SearchArtist[]) : []}
          renderItem={isGrid ? renderArtistGridItem : renderArtistItem}
          keyExtractor={artistKeyExtractor}
          numColumns={numColumns}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={isGrid ? gridListStyles.grid : undefined}
          ListEmptyComponent={emptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
      <TrackActionsSheet
        target={songActions.actionsTarget}
        onClose={songActions.closeActions}
      />
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    ...Fonts.medium,
  },
});

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load results" />;
}
