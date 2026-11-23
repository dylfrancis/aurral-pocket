import { useCallback, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useItemActions } from "@/components/actions/item-actions-context";
import { librarySearchAlbumTarget } from "@/components/actions/targets";
import { EmptyState } from "@/components/library/EmptyState";
import { TrackActionsSheet } from "@/components/library/TrackActionsSheet";
import { AlbumSearchStatusBadge } from "@/components/search/AlbumSearchStatusBadge";
import { CatalogNotice } from "@/components/search/CatalogNotice";
import { SearchAlbumRow } from "@/components/search/SearchAlbumRow";
import { SearchArtistRow } from "@/components/search/SearchArtistRow";
import {
  SearchPlaylistRow,
  searchPlaylistHref,
  searchPlaylistKey,
} from "@/components/search/SearchPlaylistRow";
import { SearchPreviewRow } from "@/components/search/SearchPreviewRow";
import {
  SearchSectionLabel,
  SeeAllRow,
} from "@/components/search/SearchSections";
import { SearchSongRow } from "@/components/search/SearchSongRow";
import { SkeletonRows } from "@/components/search/SkeletonRows";
import { MediaRow } from "@/components/ui/MediaRow";
import { PillRow } from "@/components/ui/PillRow";
import type { PillRowItem } from "@/components/ui/pill-row";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useLibraryAlbumLookup } from "@/hooks/search/use-library-album-lookup";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import type { SearchResultsData } from "@/hooks/search/use-search-results";
import { useSearchSongActions } from "@/hooks/search/use-search-song-actions";
import { useColors } from "@/hooks/use-colors";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { releaseYear } from "@/lib/date-time";
import {
  libraryAlbumHref,
  type AlbumResult,
  type ArtistResult,
} from "@/lib/search-results";
import type { SearchArtist } from "@/lib/types/search";

export type SearchFilter = "all" | "artists" | "songs" | "playlists" | "albums";
export type SearchSection = Exclude<SearchFilter, "all">;

/** The order of both the sections and their pills. */
const SECTION_ORDER: readonly SearchSection[] = [
  "artists",
  "albums",
  "songs",
  "playlists",
];

export const SEARCH_FILTERS: readonly SearchFilter[] = [
  "all",
  ...SECTION_ORDER,
];

const FILTER_LABELS: Record<SearchFilter, string> = {
  all: "All",
  artists: "Artists",
  albums: "Albums",
  songs: "Songs",
  playlists: "Playlists",
};

const FILTER_ITEMS: PillRowItem<SearchFilter>[] = SEARCH_FILTERS.map((id) => ({
  id,
  label: FILTER_LABELS[id],
}));

const PREVIEW_ROWS = 3;
const ALL_ROWS = 5;
const SKELETON_ROWS = 8;

type SearchResultsProps = {
  query: string;
  results: SearchResultsData;
  /**
   * `preview` is the type-ahead: a few rows per section. `full` adds the
   * filter pills, longer sections, and each section's whole list.
   */
  view: "preview" | "full";
  filter: SearchFilter;
  onFilterChange: (filter: SearchFilter) => void;
  onTagPress: (tag: string) => void;
  /** Search remembers the artists opened from it. */
  onArtistOpen?: (artist: SearchArtist) => void;
};

/**
 * Library artists and albums lead their sections, so they still show when the
 * catalog doesn't answer.
 */
export function SearchResults({
  query,
  results,
  view,
  filter,
  onFilterChange,
  onTagPress,
  onArtistOpen,
}: SearchResultsProps) {
  const router = useRouter();
  const itemActions = useItemActions();
  const colors = useColors();
  const openArtist = useOpenArtist();
  const hasPermission = useHasPermission();
  const songActions = useSearchSongActions();
  const trimmedQuery = query.trim();

  const {
    artists,
    albums,
    songs,
    playlists,
    tags,
    artistsAndAlbumsPending,
    libraryPending,
    catalogDown,
    retryCatalog,
    nothingFound,
  } = results;

  const { isInLibrary } = useLibraryLookup(
    artists.flatMap((row) => (row.fromLibrary ? [] : [row.artist.id])),
  );
  const catalogAlbums = albums.flatMap((row) =>
    row.kind === "catalog" ? [row.album] : [],
  );
  const { statusFor, openAlbum } = useLibraryAlbumLookup(catalogAlbums);

  const pressArtist = useCallback(
    (row: ArtistResult) => {
      onArtistOpen?.(row.artist);
      openArtist({
        mbid: row.artist.id,
        name: row.artist.name,
        coverUrl: row.image,
      });
    },
    [onArtistOpen, openArtist],
  );

  if (!results.hasQuery || results.isTagSearch) {
    return null;
  }

  const filterItems = hasPermission("accessPlaylists")
    ? FILTER_ITEMS
    : FILTER_ITEMS.filter((item) => item.id !== "playlists");
  const activeFilter = view === "full" ? filter : "all";

  const artistRow = (row: ArtistResult) => (
    <SearchArtistRow
      key={`artist-${row.artist.id}`}
      artist={row.artist}
      image={row.image}
      isInLibrary={row.fromLibrary || isInLibrary(row.artist.id)}
      onPress={() => pressArtist(row)}
      onLongPress={() =>
        itemActions.openArtist({
          ref: row.artist.id,
          name: row.artist.name,
          coverUrl: row.image,
        })
      }
    />
  );

  const albumRow = (row: AlbumResult) =>
    row.kind === "library" ? (
      <MediaRow
        key={row.key}
        imageType="album"
        mbid={row.album.id}
        coverUrl={row.album.coverUrl ?? undefined}
        title={row.album.title}
        subtitle={row.album.artistName}
        detail={releaseYear(row.album.releaseDate)?.toString() ?? undefined}
        // Library search only sends albums with a file to play.
        trailing={<AlbumSearchStatusBadge status="available" />}
        onPress={() => router.push(libraryAlbumHref(row.album))}
        onLongPress={() =>
          itemActions.openAlbum(librarySearchAlbumTarget(row.album))
        }
      />
    ) : (
      <SearchAlbumRow
        key={row.key}
        album={row.album}
        status={statusFor(row.album)}
        onPress={() => void openAlbum(row.album)}
        onLongPress={() =>
          itemActions.openAlbum({
            mbid: row.album.id,
            title: row.album.title,
            artistName: row.album.artistName,
            artistMbid: row.album.artistMbid,
            coverUrl: row.album.coverUrl,
            releaseDate: row.album.releaseDate,
          })
        }
      />
    );

  const songRow = (track: (typeof songs)[number]) => (
    <SearchSongRow
      key={`song-${track.id}`}
      track={track}
      onPress={() => void songActions.play(track)}
      onOpenActions={() => songActions.openActions(track)}
    />
  );

  const playlistRow = (playlist: (typeof playlists)[number]) => (
    <SearchPlaylistRow
      key={searchPlaylistKey(playlist)}
      playlist={playlist}
      onPress={() => router.push(searchPlaylistHref(playlist))}
    />
  );

  const sections: Record<
    SearchSection,
    {
      title: string;
      rows: ReactNode[];
      pending: boolean;
      skeleton: "artist" | "album";
      emptyMessage: string;
    }
  > = {
    artists: {
      title: "Artists",
      rows: artists.map(artistRow),
      pending: artistsAndAlbumsPending,
      skeleton: "artist",
      emptyMessage: `No artists match “${trimmedQuery}”`,
    },
    songs: {
      title: "Songs",
      rows: songs.map(songRow),
      pending: libraryPending,
      skeleton: "album",
      emptyMessage: `No songs in your Library match “${trimmedQuery}”`,
    },
    // Most searches match no playlist, so the section gets no skeleton.
    playlists: {
      title: "Playlists",
      rows: playlists.map(playlistRow),
      pending: false,
      skeleton: "album",
      emptyMessage: `None of your playlists match “${trimmedQuery}”`,
    },
    albums: {
      title: "Albums",
      rows: albums.map(albumRow),
      pending: artistsAndAlbumsPending,
      skeleton: "album",
      emptyMessage: `No albums match “${trimmedQuery}”`,
    },
  };
  const usesCatalog = (key: SearchFilter) =>
    key === "all" || key === "artists" || key === "albums";

  let content: ReactNode;
  if (activeFilter !== "all") {
    const section = sections[activeFilter];
    content =
      section.rows.length > 0 ? (
        section.rows
      ) : section.pending ? (
        <SkeletonRows count={SKELETON_ROWS} variant={section.skeleton} />
      ) : (
        <EmptyState icon="search-outline" message={section.emptyMessage} />
      );
  } else if (nothingFound && tags.length === 0) {
    content = catalogDown ? (
      <EmptyState
        icon="cloud-offline-outline"
        message={`The catalog didn’t answer, and nothing in your Library matches “${trimmedQuery}”`}
        actionLabel="Try Again"
        onAction={retryCatalog}
      />
    ) : (
      <EmptyState
        icon="search-outline"
        message={`No results for “${trimmedQuery}”`}
      />
    );
  } else {
    const limit = view === "full" ? ALL_ROWS : PREVIEW_ROWS;
    content = (
      <>
        {tags.length > 0 && (
          <View>
            <SearchSectionLabel text="Tags" />
            {tags.slice(0, PREVIEW_ROWS).map((tag) => (
              <SearchPreviewRow
                key={`tag-${tag}`}
                icon="pricetag-outline"
                iconColor={colors.brandStrong}
                label={`#${tag}`}
                onPress={() => onTagPress(tag)}
              />
            ))}
          </View>
        )}
        {SECTION_ORDER.map((key) => {
          const section = sections[key];
          const showSkeleton = section.pending && section.rows.length === 0;
          if (!showSkeleton && section.rows.length === 0) return null;
          return (
            <View key={key}>
              <SearchSectionLabel text={section.title} />
              {showSkeleton ? (
                <SkeletonRows count={limit} variant={section.skeleton} />
              ) : (
                section.rows.slice(0, limit)
              )}
              {section.rows.length > limit && (
                <SeeAllRow
                  label={`See all ${section.title.toLowerCase()}`}
                  onPress={() => onFilterChange(key)}
                />
              )}
            </View>
          );
        })}
      </>
    );
  }

  return (
    <View style={styles.container}>
      {view === "full" && (
        <View style={styles.pills}>
          <PillRow
            items={filterItems}
            selected={activeFilter}
            onSelect={onFilterChange}
          />
        </View>
      )}
      {catalogDown && usesCatalog(activeFilter) && !nothingFound && (
        <CatalogNotice onRetry={retryCatalog} />
      )}
      {content}
      <TrackActionsSheet
        target={songActions.actionsTarget}
        onClose={songActions.closeActions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  pills: {
    paddingTop: 4,
    paddingBottom: 4,
  },
});
