import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  librarySong,
  topTrackSong,
  type ArtistSong,
} from "@/components/artist/ArtistSongRow";
import {
  ARTIST_SONGS_SHOW_OPTIONS,
  type ArtistSongsShow,
} from "@/components/artist/artist-songs-filter-types";
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
import { useSavedTrackIds } from "@/lib/offline/saved-library";
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

type Remembered = { view: ArtistSongsView; show: ArtistSongsShow };

function parseRemembered(stored: unknown): Remembered {
  const value =
    stored && typeof stored === "object"
      ? (stored as Partial<Record<keyof Remembered, unknown>>)
      : {};
  return {
    view:
      ARTIST_SONGS_VIEWS.find((option) => option.id === value.view)?.id ??
      "top",
    show:
      ARTIST_SONGS_SHOW_OPTIONS.find((option) => option.value === value.show)
        ?.value ?? "everything",
  };
}

function pickView(
  available: Record<ArtistSongsView, boolean>,
  remembered: ArtistSongsView,
): ArtistSongsView | null {
  if (available[remembered]) return remembered;
  if (available.top) return "top";
  return ARTIST_SONGS_VIEWS.find((view) => available[view.id])?.id ?? null;
}

/**
 * Top tracks `show` keeps: In Library drops the clips, and Saved Offline
 * keeps the Library files saved on the phone.
 */
export function useShownTopTracks(
  topTracks: TopTrack[],
  show: ArtistSongsShow,
): TopTrack[] {
  const savedIds = useSavedTrackIds();
  return useMemo(
    () =>
      show === "everything"
        ? topTracks
        : topTracks.filter(
            ({ library }) =>
              !!library && (show === "library" || savedIds.has(library.id)),
          ),
    [topTracks, show, savedIds],
  );
}

function useShownSongs(
  songs: AlbumTrack[] | undefined,
  show: ArtistSongsShow,
): AlbumTrack[] | undefined {
  const savedIds = useSavedTrackIds();
  return useMemo(
    () =>
      show === "saved" ? songs?.filter((song) => savedIds.has(song.id)) : songs,
    [songs, show, savedIds],
  );
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
 * Played, Favorites or All Songs, narrowed by the filter. A view with no
 * songs offers no pill, and a remembered view this artist can't show falls
 * back to Top Tracks. Render a TrackActionsSheet with `actions`.
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
  // Only a Library artist has songs to narrow.
  const show: ArtistSongsShow = isLibrary ? remembered.show : "everything";
  const plays = useArtistSongList(libraryArtistId, {
    order: "plays",
    enabled: isLibrary,
  });
  const favorites = useArtistSongList(libraryArtistId, {
    order: "favorited",
    favorite: true,
    enabled: isLibrary,
  });
  const shownTopTracks = useShownTopTracks(topTracks, show);
  const shownPlays = useShownSongs(plays.songs, show);
  const shownFavorites = useShownSongs(favorites.songs, show);

  const unsavedAvailable: Record<ArtistSongsView, boolean> = {
    top: shownTopTracks.length > 0,
    plays: isLibrary && !!shownPlays?.length,
    favorites: isLibrary && !!shownFavorites?.length,
    all: isLibrary && hasSongs,
  };
  // Whether any song is saved takes the whole list.
  const allEnabled =
    isLibrary &&
    (show === "saved" || pickView(unsavedAvailable, remembered.view) === "all");
  const all = useArtistSongList(libraryArtistId, {
    order: "album",
    enabled: allEnabled,
  });
  const shownAll = useShownSongs(all.songs, show);
  const available =
    show === "saved"
      ? { ...unsavedAvailable, all: isLibrary && !!shownAll?.length }
      : unsavedAvailable;
  const views = ARTIST_SONGS_VIEWS.filter((view) => available[view.id]);
  const current = pickView(available, remembered.view);

  const librarySongs: AlbumTrack[] | undefined =
    current === "plays"
      ? shownPlays
      : current === "favorites"
        ? shownFavorites
        : current === "all"
          ? shownAll
          : undefined;

  const isLoading =
    topTracksLoading ||
    libraryLoading ||
    (isLibrary &&
      (plays.isLoading ||
        favorites.isLoading ||
        (allEnabled && all.isLoading)));

  const topTracksPlayback = useTopTracksPlayback(
    shownTopTracks,
    artistName,
    mbid,
  );
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
        ? shownTopTracks.map(topTrackSong)
        : (librarySongs ?? NO_SONGS).map(librarySong),
    [current, shownTopTracks, librarySongs],
  );

  const showAll = useCallback(() => {
    if (current === "top") {
      if (!mbid) return;
      router.push({
        pathname: "/artist/top-tracks",
        params: {
          mbid,
          artistName,
          ...(show === "everything" ? {} : { show }),
        },
      });
      return;
    }
    if (!current || !libraryArtistId) return;
    const page = SONGS_PAGE[current];
    router.push({
      pathname: "/artist/songs",
      params: {
        artistId: libraryArtistId,
        order: page.order,
        // The page shows one filter, and Favorites keeps its own.
        show: show === "saved" && current !== "favorites" ? "saved" : page.show,
      },
    });
  }, [current, show, mbid, libraryArtistId, artistName, router]);

  const select = useCallback(
    (view: ArtistSongsView) => setRemembered({ ...remembered, view }),
    [remembered, setRemembered],
  );
  const setShow = useCallback(
    (next: ArtistSongsShow) => setRemembered({ ...remembered, show: next }),
    [remembered, setRemembered],
  );

  const playback = current === "top" ? topTracksPlayback : libraryPlayback;
  const currentLabel =
    ARTIST_SONGS_VIEWS.find((view) => view.id === current)?.label ??
    "Top Tracks";

  return {
    /**
     * Songs over a pill row, and for a Library artist while its views load
     * or when the filter leaves none; with one view, that view's name.
     */
    title:
      views.length > 1 || (inLibrary && (isLoading || views.length === 0))
        ? "Songs"
        : currentLabel,
    currentLabel,
    pills: views.length > 1 ? views : NO_VIEWS,
    selected: current,
    select,
    /** Null for an artist outside the Library, which has nothing to narrow. */
    show: isLibrary ? show : null,
    setShow,
    /** Shown when the filter leaves no view with songs. */
    emptyMessage:
      show === "saved"
        ? "No songs saved offline"
        : show === "library"
          ? "No songs in your Library"
          : null,
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
