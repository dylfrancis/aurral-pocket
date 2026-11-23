import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useItemActions } from "@/components/actions/item-actions-context";
import { librarySearchAlbumTarget } from "@/components/actions/targets";
import { EmptyState } from "@/components/library/EmptyState";
import { TrackActionsSheet } from "@/components/library/TrackActionsSheet";
import {
  SearchPlaylistRow,
  searchPlaylistHref,
  searchPlaylistKey,
} from "@/components/search/SearchPlaylistRow";
import {
  SearchSectionLabel,
  SeeAllRow,
} from "@/components/search/SearchSections";
import { SearchSongRow } from "@/components/search/SearchSongRow";
import { SkeletonRows } from "@/components/search/SkeletonRows";
import { MediaRow } from "@/components/ui/MediaRow";
import { useLibrarySearch } from "@/hooks/search/use-library-search";
import { useSearchSongActions } from "@/hooks/search/use-search-song-actions";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { releaseYear } from "@/lib/date-time";
import { useIsOffline } from "@/lib/offline/network";
import { libraryAlbumHref } from "@/lib/search-results";
import type {
  LibrarySearchAlbum,
  LibrarySearchArtist,
} from "@/lib/types/search";

const PREVIEW_LIMIT = 4;

type SectionKey = "artists" | "albums" | "songs" | "playlists";

/** From two characters, when the search starts, results replace the home. */
export function isLibrarySearchQuery(query: string) {
  return query.trim().length >= 2;
}

/**
 * Library-only matches, four per section until See All expands one in place.
 * Mount it before typing starts, so the debounce and an open song sheet hold.
 */
export function LibrarySearchResults({ query }: { query: string }) {
  const router = useRouter();
  const itemActions = useItemActions();
  const openArtist = useOpenArtist();
  const isOffline = useIsOffline();
  const trimmedQuery = query.trim();
  const { data, isError, refetch } = useLibrarySearch(
    isOffline ? "" : trimmedQuery,
  );
  const songActions = useSearchSongActions();
  // Tagged with its query, so a new search starts collapsed.
  const [expanded, setExpanded] = useState({
    query: trimmedQuery,
    sections: [] as SectionKey[],
  });
  const isExpanded = (key: SectionKey) =>
    expanded.query === trimmedQuery && expanded.sections.includes(key);
  const expand = (key: SectionKey) =>
    setExpanded((current) => ({
      query: trimmedQuery,
      sections:
        current.query === trimmedQuery ? [...current.sections, key] : [key],
    }));

  const section = <T,>(
    key: SectionKey,
    title: string,
    items: T[],
    renderRow: (item: T) => ReactNode,
  ) => {
    if (items.length === 0) return null;
    const open = isExpanded(key);
    return (
      <View>
        <SearchSectionLabel text={title} />
        {(open ? items : items.slice(0, PREVIEW_LIMIT)).map(renderRow)}
        {!open && items.length > PREVIEW_LIMIT ? (
          <SeeAllRow
            label={`See all ${title.toLowerCase()}`}
            icon="chevron-down"
            onPress={() => expand(key)}
          />
        ) : null}
      </View>
    );
  };

  const openAlbum = (album: LibrarySearchAlbum) =>
    router.push(libraryAlbumHref(album));

  const artistRow = (artist: LibrarySearchArtist) => (
    <MediaRow
      key={artist.libraryId}
      imageType="artist"
      mbid={artist.id}
      coverUrl={artist.image ?? undefined}
      title={artist.name}
      onPress={() =>
        openArtist({
          mbid: artist.id,
          name: artist.name,
          coverUrl: artist.image,
        })
      }
      onLongPress={() =>
        itemActions.openArtist({
          ref: artist.id,
          name: artist.name,
          coverUrl: artist.image,
        })
      }
    />
  );

  const albumRow = (album: LibrarySearchAlbum) => (
    <MediaRow
      key={album.libraryId}
      imageType="album"
      mbid={album.id}
      coverUrl={album.coverUrl ?? undefined}
      title={album.title}
      subtitle={[album.artistName, releaseYear(album.releaseDate)]
        .filter(Boolean)
        .join(" · ")}
      onPress={() => openAlbum(album)}
      onLongPress={() => itemActions.openAlbum(librarySearchAlbumTarget(album))}
    />
  );

  let content: ReactNode = null;
  if (!isLibrarySearchQuery(query)) {
    content = null;
  } else if (isOffline) {
    content = (
      <EmptyState
        icon="cloud-offline-outline"
        message="Searching your Library needs a connection"
        actionLabel="Open Offline"
        onAction={() => router.push("/offline")}
      />
    );
  } else if (!data) {
    content = isError ? (
      <EmptyState
        icon="alert-circle-outline"
        message="Couldn't search your Library"
        actionLabel="Try Again"
        onAction={() => void refetch()}
      />
    ) : (
      <View>
        <SearchSectionLabel text="Artists" />
        <SkeletonRows count={2} variant="artist" />
        <SearchSectionLabel text="Albums" />
        <SkeletonRows count={3} variant="album" />
      </View>
    );
  } else {
    // An artist with no MBID has no page to open. Its albums and songs still
    // match below.
    const artists = data.artists.filter((artist) => artist.hasMbid);
    const { albums, tracks, playlists } = data;
    // The last answer stays up while the next one is typed or read, dimmed
    // and inert so nothing it lists can be opened as a match.
    const isStale = data.query !== trimmedQuery;
    const isEmpty =
      artists.length + albums.length + tracks.length + playlists.length === 0;
    content = (
      <View
        pointerEvents={isStale ? "none" : "auto"}
        style={isStale && styles.stale}
      >
        {isEmpty ? (
          <EmptyState
            icon="search-outline"
            message={`Nothing in your Library matches “${data.query}”`}
          />
        ) : (
          <>
            {section("artists", "Artists", artists, artistRow)}
            {section("albums", "Albums", albums, albumRow)}
            {section("songs", "Songs", tracks, (track) => (
              <SearchSongRow
                key={track.id}
                track={track}
                onPress={() => void songActions.play(track)}
                onOpenActions={() => songActions.openActions(track)}
              />
            ))}
            {section("playlists", "Playlists", playlists, (playlist) => (
              <SearchPlaylistRow
                key={searchPlaylistKey(playlist)}
                playlist={playlist}
                onPress={() => router.push(searchPlaylistHref(playlist))}
              />
            ))}
          </>
        )}
      </View>
    );
  }

  return (
    <>
      {content}
      <TrackActionsSheet
        target={songActions.actionsTarget}
        onClose={songActions.closeActions}
      />
    </>
  );
}

const styles = StyleSheet.create({
  stale: {
    opacity: 0.5,
  },
});
