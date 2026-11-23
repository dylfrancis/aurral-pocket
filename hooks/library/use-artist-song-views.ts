import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  librarySong,
  topTrackSong,
  type ArtistSong,
} from "@/components/artist/ArtistSongRow";
import { albumTrackContext } from "@/hooks/library/album-track-context";
import {
  useArtistSongList,
  type ArtistSongOrder,
} from "@/hooks/library/use-artist-song-list";
import { useRememberedListValue } from "@/hooks/library/use-library-view";
import {
  useQueuePlayback,
  useTopTracksPlayback,
} from "@/hooks/library/use-top-tracks-playback";
import {
  toPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type { TopTrack } from "@/lib/top-tracks";
import type { AlbumTrack } from "@/lib/types/library";

export type ArtistSongsView = "top" | "plays" | "favorites" | "all";

export const ARTIST_SONGS_VIEWS: readonly {
  id: ArtistSongsView;
  label: string;
}[] = [
  { id: "top", label: "Top Tracks" },
  { id: "plays", label: "Most Played" },
  { id: "favorites", label: "Favorites" },
  { id: "all", label: "All Songs" },
];

/** How each Library view's Show All page opens. */
const SONGS_PAGE: Record<
  Exclude<ArtistSongsView, "top">,
  { order: ArtistSongOrder; show: "all" | "favorites" }
> = {
  plays: { order: "plays", show: "all" },
  favorites: { order: "favorited", show: "favorites" },
  all: { order: "album", show: "all" },
};

type Remembered = { view: ArtistSongsView };

function parseRemembered(stored: unknown): Remembered {
  const view =
    stored && typeof stored === "object"
      ? (stored as Partial<Record<keyof Remembered, unknown>>).view
      : undefined;
  return {
    view: ARTIST_SONGS_VIEWS.find((option) => option.id === view)?.id ?? "top",
  };
}

type ArtistSongViewsOptions = {
  mbid: string | undefined;
  /** The canonical artist id; the Library views need it. */
  libraryArtistId: string | undefined;
  artistName: string;
  inLibrary: boolean;
  topTracks: TopTrack[];
  topTracksLoading: boolean;
  /** True while the Library reads that name the artist and its songs load. */
  libraryLoading: boolean;
  hasSongs: boolean;
};

/**
 * The artist page's songs: Top Tracks, or for a Library artist its Most
 * Played, Favorites or All Songs. A view with no songs offers no pill, and a
 * remembered view this artist can't show falls back to Top Tracks. Render a
 * TrackActionsSheet with `actions`.
 */
export function useArtistSongViews({
  mbid,
  libraryArtistId,
  artistName,
  inLibrary,
  topTracks,
  topTracksLoading,
  libraryLoading,
  hasSongs,
}: ArtistSongViewsOptions) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [remembered, setRemembered] = useRememberedListValue(
    "artist-songs",
    parseRemembered,
  );

  const isLibrary = inLibrary && !!libraryArtistId;
  const plays = useArtistSongList(libraryArtistId, {
    order: "plays",
    enabled: isLibrary,
  });
  const favorites = useArtistSongList(libraryArtistId, {
    order: "favorited",
    favorite: true,
    enabled: isLibrary,
  });

  const available: Record<ArtistSongsView, boolean> = {
    top: topTracks.length > 0,
    plays: isLibrary && !!plays.songs?.length,
    favorites: isLibrary && !!favorites.songs?.length,
    all: isLibrary && hasSongs,
  };
  const views = ARTIST_SONGS_VIEWS.filter((view) => available[view.id]);
  const current: ArtistSongsView | null = available[remembered.view]
    ? remembered.view
    : available.top
      ? "top"
      : (views[0]?.id ?? null);

  const all = useArtistSongList(libraryArtistId, {
    order: "album",
    enabled: isLibrary && current === "all",
  });
  const librarySongs: AlbumTrack[] | undefined =
    current === "plays"
      ? plays.songs
      : current === "favorites"
        ? favorites.songs
        : current === "all"
          ? all.songs
          : undefined;

  const isLoading =
    topTracksLoading ||
    libraryLoading ||
    (isLibrary &&
      (plays.isLoading ||
        favorites.isLoading ||
        (current === "all" && all.isLoading)));

  const topTracksPlayback = useTopTracksPlayback(topTracks, artistName, mbid);
  const libraryPlayback = useLibrarySongsPlayback(
    librarySongs ?? NO_SONGS,
    artistName,
    mbid,
  );
  const { open } = topTracksPlayback.actions;
  const openLibraryActions = useCallback(
    (index: number) => {
      const song = librarySongs?.[index];
      if (song) open(song, albumTrackContext(song, queryClient));
    },
    [librarySongs, open, queryClient],
  );

  const songs = useMemo(
    (): ArtistSong[] =>
      current === "top"
        ? topTracks.map(topTrackSong)
        : (librarySongs ?? NO_SONGS).map(librarySong),
    [current, topTracks, librarySongs],
  );

  const showAll = useCallback(() => {
    if (current === "top") {
      if (!mbid) return;
      router.push({
        pathname: "/artist/top-tracks",
        params: { mbid, artistName },
      });
      return;
    }
    if (!current || !libraryArtistId) return;
    router.push({
      pathname: "/artist/songs",
      params: { artistId: libraryArtistId, ...SONGS_PAGE[current] },
    });
  }, [current, mbid, libraryArtistId, artistName, router]);

  const select = useCallback(
    (view: ArtistSongsView) => setRemembered({ ...remembered, view }),
    [remembered, setRemembered],
  );

  const playback = current === "top" ? topTracksPlayback : libraryPlayback;
  const currentLabel =
    ARTIST_SONGS_VIEWS.find((view) => view.id === current)?.label ??
    "Top Tracks";

  return {
    /**
     * Songs over a pill row, and while a Library artist's views load; with
     * one view, that view's name.
     */
    title:
      views.length > 1 || (isLoading && inLibrary) ? "Songs" : currentLabel,
    currentLabel,
    pills: views.length > 1 ? views : NO_VIEWS,
    selected: current,
    select,
    songs,
    isLoading,
    itemIds: playback.itemIds,
    currentId: playback.currentId,
    isPlaying: playback.isPlaying,
    playFrom: playback.playFrom,
    playAll: playback.playAll,
    openActions:
      current === "top" ? topTracksPlayback.openActions : openLibraryActions,
    showAll,
    actions: topTracksPlayback.actions,
  };
}

const NO_SONGS: AlbumTrack[] = [];
const NO_VIEWS: typeof ARTIST_SONGS_VIEWS = [];

function useLibrarySongsPlayback(
  songs: AlbumTrack[],
  artistName: string,
  mbid: string | undefined,
) {
  const queryClient = useQueryClient();
  const context = useMemo<PlayerAlbumContext>(
    () => ({
      albumTitle: artistName,
      artistName,
      coverPath: null,
      artworkUrl: null,
      albumMbid: null,
      artistMbid: mbid ?? null,
    }),
    [artistName, mbid],
  );
  const itemIds = useMemo(() => songs.map((song) => song.id), [songs]);
  const items = useCallback(
    () =>
      songs
        .map((song) =>
          toPlayerTrack(song, albumTrackContext(song, queryClient)),
        )
        .filter((item): item is PlayerTrack => item !== null),
    [songs, queryClient],
  );
  return useQueuePlayback(itemIds, items, context);
}
