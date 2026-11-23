import { useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import AlbumIcon from "@expo/material-symbols/album.xml";
import {
  LIBRARY_SONG_SORT_OPTIONS,
  type SortOption,
} from "@/components/library/AlbumSortPicker";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { SongRow } from "@/components/library/SongRow";
import {
  TrackActionsSheet,
  useTrackActions,
} from "@/components/library/TrackActionsSheet";
import {
  menuOptionSection,
  type MenuOption,
} from "@/components/ui/MenuOptions";
import { SEARCH_PLACEHOLDERS } from "@/constants/navigation";
import { albumTrackContext } from "@/hooks/library/album-track-context";
import {
  useArtistSongList,
  type ArtistSongOrder,
} from "@/hooks/library/use-artist-song-list";
import { offeredSort, sortsFor } from "@/hooks/library/use-library-view";
import { usePlaySongs } from "@/hooks/library/use-play-songs";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useSavedTrackIds } from "@/lib/offline/saved-library";
import type { AlbumTrack } from "@/lib/types/library";

type RouteParams = {
  /** The canonical artist id. */
  artistId: string;
  order?: string;
  show?: string;
};

type Show = "all" | "favorites" | "saved";

const ALBUM_ORDER: SortOption<"album"> = {
  key: "album",
  label: "Album Order",
  icon: "albums-outline",
  iosIcon: "square.stack",
  androidIcon: AlbumIcon,
};

// Every song here is the artist's, so sorting by artist changes nothing.
const SORT_OPTIONS: SortOption<ArtistSongOrder>[] = [
  ALBUM_ORDER,
  ...LIBRARY_SONG_SORT_OPTIONS.filter(
    (option) => option.key !== "artist-asc" && option.key !== "artist-desc",
  ),
];

const SHOW_OPTIONS: MenuOption<Show>[] = [
  { key: "all", label: "All Songs" },
  { key: "favorites", label: "Favorites" },
  { key: "saved", label: "Saved Offline" },
];

const EMPTY_MESSAGES: Record<Show, string> = {
  all: "No songs to show",
  favorites: "No favorite songs",
  saved: "No songs saved offline",
};

function matches(song: AlbumTrack, query: string) {
  return (
    song.trackName.toLowerCase().includes(query) ||
    !!song.album?.albumName.toLowerCase().includes(query)
  );
}

/**
 * A Library artist's songs, opened from Show All on the artist page with that
 * view's sort and filter. Changes here aren't remembered: each Show All
 * opens on its own view.
 */
export function ArtistSongsScreen() {
  const params = useLocalSearchParams<RouteParams>();
  const queryClient = useQueryClient();
  const trackActions = useTrackActions();
  const playSongs = usePlaySongs();

  const [show, setShow] = useState<Show>(
    () =>
      SHOW_OPTIONS.find((option) => option.key === params.show)?.key ?? "all",
  );
  const [order, setOrder] = useState<ArtistSongOrder>(
    () =>
      SORT_OPTIONS.find((option) => option.key === params.order)?.key ??
      "album",
  );
  const sortOptions = useMemo(() => sortsFor(SORT_OPTIONS, show), [show]);
  const sortMode = offeredSort(sortOptions, order);

  const list = useArtistSongList(params.artistId, {
    order: sortMode,
    favorite: show === "favorites",
    throwOnError: true,
  });
  const { refreshing, onRefresh } = usePullToRefresh(list.refetch);

  const savedIds = useSavedTrackIds();
  const shown = useMemo(
    () =>
      show === "saved"
        ? list.songs?.filter((song) => savedIds.has(song.id))
        : list.songs,
    [list.songs, show, savedIds],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const items = useMemo(() => {
    const songs = shown ?? [];
    const query = searchQuery.trim().toLowerCase();
    return query ? songs.filter((song) => matches(song, query)) : songs;
  }, [shown, searchQuery]);

  const filterSections = useMemo(
    () => ({ show: menuOptionSection("Show", SHOW_OPTIONS, show, setShow) }),
    [show],
  );

  return (
    <ReleaseGrid
      items={items}
      isLoading={list.songs === undefined && list.isLoading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      sortMode={sortMode}
      onSortChange={setOrder}
      sortOptions={sortOptions}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={SEARCH_PLACEHOLDERS.artistSongs}
      hasUnderlyingItems={(shown?.length ?? 0) > 0}
      emptyMessage={EMPTY_MESSAGES[show]}
      emptyIcon="musical-notes-outline"
      filterSections={filterSections}
      filtered={show !== "all"}
      renderListItem={(song) => (
        <SongRow
          track={song}
          onPress={() => void playSongs(items, song)}
          onOpenActions={() =>
            trackActions.open(song, albumTrackContext(song, queryClient))
          }
        />
      )}
      keyExtractor={(song) => song.id}
      bottomSheet={
        <TrackActionsSheet
          target={trackActions.target}
          onClose={trackActions.close}
        />
      }
    />
  );
}
