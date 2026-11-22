import { useCallback, useRef, useState } from "react";
import { Keyboard, ScrollView, StyleSheet, View } from "react-native";
import type { NativeSyntheticEvent } from "react-native";
import type { SearchBarTextEventData } from "react-native-screens";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonRows } from "@/components/search/SkeletonRows";
import { SearchPreviewRow } from "@/components/search/SearchPreviewRow";
import {
  SearchSectionLabel,
  SeeAllRow,
} from "@/components/search/SearchSections";
import { SearchArtistRow } from "@/components/search/SearchArtistRow";
import { SearchAlbumRow } from "@/components/search/SearchAlbumRow";
import { SearchSongRow } from "@/components/search/SearchSongRow";
import {
  SearchPlaylistRow,
  searchPlaylistHref,
  searchPlaylistKey,
} from "@/components/search/SearchPlaylistRow";
import { TrackActionsSheet } from "@/components/library/TrackActionsSheet";
import Mic from "@expo/material-symbols/mic.xml";
import { ShazamSheet } from "@/components/shazam";
import { isShazamAvailable } from "@/modules/shazam";
import { RecentSearches } from "@/components/search/RecentSearches";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import { useAlbumSearch } from "@/hooks/search/use-album-search";
import { useTagSuggestions } from "@/hooks/search/use-tag-suggestions";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useLibraryAlbumLookup } from "@/hooks/search/use-library-album-lookup";
import { useLibrarySearch } from "@/hooks/search/use-library-search";
import { useSearchSongActions } from "@/hooks/search/use-search-song-actions";
import { useRecentSearches } from "@/hooks/search/use-recent-searches";
import { searchBarColors } from "@/constants/navigation";
import { IS_IOS } from "@/constants/platform";
import { SettingsToolbar } from "@/components/navigation/SettingsToolbar";
import type { RecentSearch } from "@/hooks/search/use-recent-searches";
import type { SearchArtist } from "@/lib/types/search";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { useColors } from "@/hooks/use-colors";

const ARTIST_PREVIEW_LIMIT = 3;
const ALBUM_PREVIEW_LIMIT = 3;
const SONG_PREVIEW_LIMIT = 3;
const PLAYLIST_PREVIEW_LIMIT = 3;
const TAG_PREVIEW_LIMIT = 5;

export default function SearchScreen() {
  const router = useRouter();
  const openArtist = useOpenArtist();
  const colors = useColors();

  const [query, setQuery] = useState("");
  const recentSearches = useRecentSearches();

  const isTagSearch = query.trimStart().startsWith("#");
  const tagQuery = isTagSearch ? query.trimStart().slice(1).trim() : "";
  const artistQuery = isTagSearch ? "" : query;
  const hasQuery =
    query.trim().length >= 2 || (isTagSearch && tagQuery.length >= 2);

  const {
    data: artistData,
    isLoading: artistLoading,
    isPlaceholderData: artistIsStale,
  } = useArtistSearch(artistQuery);

  const {
    data: albumData,
    isLoading: albumLoading,
    isPlaceholderData: albumIsStale,
  } = useAlbumSearch(artistQuery);

  const {
    data: libraryData,
    isLoading: libraryLoading,
    isPlaceholderData: libraryIsStale,
  } = useLibrarySearch(artistQuery);

  const { data: tags } = useTagSuggestions(
    isTagSearch ? tagQuery : artistQuery,
  );
  const artists = artistData?.artists;
  const { isInLibrary } = useLibraryLookup(
    artists?.map((artist) => artist.id) ?? [],
  );
  const albums = albumData?.items;
  const songs = libraryData?.tracks;
  const playlists = libraryData?.playlists;
  const songActions = useSearchSongActions();

  const { add: addRecentSearch } = recentSearches;

  const pushResults = useCallback(
    (q: string, scope?: "artist" | "album" | "song" | "playlist") => {
      Keyboard.dismiss();
      if (q.startsWith("#")) {
        addRecentSearch({ type: "tag", text: q.slice(1) });
      } else {
        addRecentSearch({ type: "query", text: q });
      }
      router.push({
        pathname: "/results",
        params: scope ? { q, scope } : { q },
      });
    },
    [router, addRecentSearch],
  );

  // Stack.SearchBar re-registers its native header options whenever a prop
  // identity changes. Keep every handler stable so typing does not churn the
  // header config — on Android the toolbar menu that hosts the search icon is
  // rebuilt from it, and rebuilds can drop the icon (react-native-screens
  // issue #2271).
  const handleChangeText = useCallback(
    (e: NativeSyntheticEvent<SearchBarTextEventData>) =>
      setQuery(e.nativeEvent.text),
    [],
  );

  const handleCancelSearch = useCallback(() => setQuery(""), []);

  const handleSearchSubmit = useCallback(
    (e: NativeSyntheticEvent<SearchBarTextEventData>) => {
      const q = e.nativeEvent.text.trim();
      if (q) pushResults(q);
    },
    [pushResults],
  );

  const handleTagSelect = useCallback(
    (tag: string) => pushResults(`#${tag}`),
    [pushResults],
  );

  const handleArtistPress = useCallback(
    (artist: SearchArtist) => {
      addRecentSearch({
        type: "artist",
        text: artist.name,
        mbid: artist.id,
      });
      openArtist({ mbid: artist.id, name: artist.name });
    },
    [openArtist, addRecentSearch],
  );

  const previewTags = hasQuery
    ? (tags ?? []).slice(0, isTagSearch ? TAG_PREVIEW_LIMIT : 3)
    : [];
  const previewArtists =
    hasQuery && !isTagSearch
      ? (artists ?? []).slice(0, ARTIST_PREVIEW_LIMIT)
      : [];
  const previewAlbums =
    hasQuery && !isTagSearch
      ? (albums ?? []).slice(0, ALBUM_PREVIEW_LIMIT)
      : [];
  const previewSongs =
    hasQuery && !isTagSearch ? (songs ?? []).slice(0, SONG_PREVIEW_LIMIT) : [];
  // Most queries match no playlist, so the section gets no skeleton. It
  // waits for this query's answer instead of showing the last one's.
  const previewPlaylists =
    hasQuery && !isTagSearch && !libraryIsStale
      ? (playlists ?? []).slice(0, PLAYLIST_PREVIEW_LIMIT)
      : [];

  const showArtistSkeleton =
    hasQuery && !isTagSearch && (artistLoading || artistIsStale);
  const showAlbumSkeleton =
    hasQuery && !isTagSearch && (albumLoading || albumIsStale);
  const showSongSkeleton =
    hasQuery && !isTagSearch && (libraryLoading || libraryIsStale);
  const showArtistSection = showArtistSkeleton || previewArtists.length > 0;
  const showAlbumSection = showAlbumSkeleton || previewAlbums.length > 0;
  const showSongSection = showSongSkeleton || previewSongs.length > 0;

  const noResults =
    hasQuery &&
    !isTagSearch &&
    !artistLoading &&
    !albumLoading &&
    !libraryLoading &&
    !artistIsStale &&
    !albumIsStale &&
    !libraryIsStale &&
    previewArtists.length === 0 &&
    previewAlbums.length === 0 &&
    previewSongs.length === 0 &&
    previewPlaylists.length === 0 &&
    previewTags.length === 0;

  const noTagResults = hasQuery && isTagSearch && previewTags.length === 0;

  const { statusFor: albumStatusFor, openAlbum } =
    useLibraryAlbumLookup(previewAlbums);

  const shazamSheetRef = useRef<BottomSheetModal | null>(null);
  const handleShazamArtist = useCallback(
    (mbid: string, name: string) => openArtist({ mbid, name }),
    [openArtist],
  );

  let content;

  if (noResults || noTagResults) {
    content = (
      <EmptyState
        icon="search-outline"
        message={`No results for \u201C${query.trim()}\u201D`}
      />
    );
  } else if (hasQuery) {
    const hasMoreArtists =
      !isTagSearch && (artists?.length ?? 0) > ARTIST_PREVIEW_LIMIT;
    const hasMoreAlbums =
      !isTagSearch && (albums?.length ?? 0) > ALBUM_PREVIEW_LIMIT;
    const hasMoreSongs =
      !isTagSearch && (songs?.length ?? 0) > SONG_PREVIEW_LIMIT;
    const hasMorePlaylists =
      !isTagSearch && (playlists?.length ?? 0) > PLAYLIST_PREVIEW_LIMIT;
    const hasMoreTags = isTagSearch && (tags?.length ?? 0) > TAG_PREVIEW_LIMIT;

    content = (
      <View style={styles.previewSection}>
        {previewTags.length > 0 && (
          <View>
            <SearchSectionLabel text="Tags" />
            {previewTags.map((tag) => (
              <SearchPreviewRow
                key={`tag-${tag}`}
                icon="pricetag-outline"
                iconColor={colors.brandStrong}
                label={`#${tag}`}
                onPress={() => handleTagSelect(tag)}
              />
            ))}
          </View>
        )}

        {showArtistSection && (
          <View>
            <SearchSectionLabel text="Artists" />
            {showArtistSkeleton ? (
              <SkeletonRows count={ARTIST_PREVIEW_LIMIT} variant="artist" />
            ) : (
              <>
                {previewArtists.map((artist) => (
                  <SearchArtistRow
                    key={`artist-${artist.id}`}
                    artist={artist}
                    isInLibrary={isInLibrary(artist.id)}
                    onPress={() => handleArtistPress(artist)}
                  />
                ))}
                {hasMoreArtists && (
                  <SeeAllRow
                    label="See all artists"
                    onPress={() => pushResults(query.trim(), "artist")}
                  />
                )}
              </>
            )}
          </View>
        )}

        {showSongSection && (
          <View>
            <SearchSectionLabel text="Songs" />
            {showSongSkeleton ? (
              <SkeletonRows count={SONG_PREVIEW_LIMIT} variant="album" />
            ) : (
              <>
                {previewSongs.map((track) => (
                  <SearchSongRow
                    key={`song-${track.id}`}
                    track={track}
                    onPress={() => void songActions.play(track)}
                    onOpenActions={() => songActions.openActions(track)}
                  />
                ))}
                {hasMoreSongs && (
                  <SeeAllRow
                    label="See all songs"
                    onPress={() => pushResults(query.trim(), "song")}
                  />
                )}
              </>
            )}
          </View>
        )}

        {previewPlaylists.length > 0 && (
          <View>
            <SearchSectionLabel text="Playlists" />
            {previewPlaylists.map((playlist) => (
              <SearchPlaylistRow
                key={searchPlaylistKey(playlist)}
                playlist={playlist}
                onPress={() => router.push(searchPlaylistHref(playlist))}
              />
            ))}
            {hasMorePlaylists && (
              <SeeAllRow
                label="See all playlists"
                onPress={() => pushResults(query.trim(), "playlist")}
              />
            )}
          </View>
        )}

        {showAlbumSection && (
          <View>
            <SearchSectionLabel text="Albums" />
            {showAlbumSkeleton ? (
              <SkeletonRows count={ALBUM_PREVIEW_LIMIT} variant="album" />
            ) : (
              <>
                {previewAlbums.map((album) => (
                  <SearchAlbumRow
                    key={`album-${album.id}`}
                    album={album}
                    status={albumStatusFor(album)}
                    onPress={() => void openAlbum(album)}
                  />
                ))}
                {hasMoreAlbums && (
                  <SeeAllRow
                    label="See all albums"
                    onPress={() => pushResults(query.trim(), "album")}
                  />
                )}
              </>
            )}
          </View>
        )}

        {hasMoreTags && (
          <SeeAllRow
            label="See all tag results"
            onPress={() => pushResults(query.trim())}
          />
        )}
      </View>
    );
  } else if (recentSearches.searches.length > 0) {
    content = (
      <RecentSearches
        searches={recentSearches.searches}
        onSelect={(entry: RecentSearch) => {
          if (entry.type === "artist") {
            openArtist({ mbid: entry.mbid, name: entry.text });
          } else if (entry.type === "tag") {
            pushResults(`#${entry.text}`);
          } else {
            pushResults(entry.text);
          }
        }}
        onRemove={recentSearches.remove}
        onClear={recentSearches.clear}
      />
    );
  } else {
    content = (
      <EmptyState
        icon="search-outline"
        message="Search for artists, songs, playlists or #tags"
      />
    );
  }

  return (
    <>
      <Stack.SearchBar
        placeholder="Artists, songs, playlists, #tags..."
        hideWhenScrolling={false}
        autoCapitalize="none"
        {...searchBarColors(colors)}
        onChangeText={handleChangeText}
        onCancelButtonPress={handleCancelSearch}
        onSearchButtonPress={handleSearchSubmit}
      />
      <SettingsToolbar />
      <Stack.Toolbar placement="right">
        {isShazamAvailable && (
          <Stack.Toolbar.Button
            icon={IS_IOS ? "mic" : Mic}
            accessibilityLabel="Identify song"
            onPress={() => shazamSheetRef.current?.present()}
          >
            Identify song
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {content}
      </ScrollView>
      <ShazamSheet
        sheetRef={shazamSheetRef}
        onViewArtist={handleShazamArtist}
        onViewRelease={(params) =>
          router.push({ pathname: "/release/[mbid]", params })
        }
        onSearchManually={(q) => pushResults(q, "artist")}
      />
      <TrackActionsSheet
        target={songActions.actionsTarget}
        onClose={songActions.closeActions}
      />
    </>
  );
}

const styles = StyleSheet.create({
  previewSection: {
    paddingTop: 4,
  },
});

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load search" />;
}
