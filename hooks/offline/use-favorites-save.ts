import { useCallback } from "react";
import { Alert } from "react-native";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { FAVORITE_SORT_OPTIONS } from "@/components/library/AlbumSortPicker";
import { albumTrackContext } from "@/hooks/library/album-track-context";
import { getCanonicalAlbumTracks } from "@/lib/api/library";
import { sortByDisc } from "@/lib/album-discs";
import { libraryTracksRef } from "@/lib/library-read";
import { mapWithLimit } from "@/lib/map-with-limit";
import { formatBytes } from "@/lib/offline/format";
import {
  hasSaved,
  setFavoritesSave,
  useFavoritesSave,
  type FavoriteAlbumSave,
  type FavoriteSongSave,
  type FavoritesSaveMode,
} from "@/lib/offline/saved-library";
import { toSavedTrack } from "@/lib/player/saved-queue";
import { libraryTrackFields } from "@/lib/player/track-item";
import { libraryKeys } from "@/lib/query-keys";
import type { Album, FavoriteLists, Track } from "@/lib/types/library";

/** The order Favorites is read in to save it: the screen's first sort. */
export const FAVORITES_SAVE_SORT = FAVORITE_SORT_OPTIONS[0].key;

const ALBUM_READS_AT_ONCE = 3;
/** An album's tracks seldom change, so a save reuses a recent read. */
const ALBUM_TRACKS_STALE_MS = 5 * 60 * 1000;
/**
 * How long the save question waits on album track lists for their sizes.
 * Reads still out then carry on, and the save that follows uses them.
 */
const SIZE_READS_WAIT_MS = 2000;

/**
 * What Favorites keeps, from a full read of the favorites. Only albums not yet
 * on the phone have their tracks read, so each heart doesn't reread them all.
 */
export async function favoriteSaves(
  queryClient: QueryClient,
  lists: FavoriteLists,
  mode: FavoritesSaveMode,
): Promise<{ songs: FavoriteSongSave[]; albums: FavoriteAlbumSave[] }> {
  const songs = lists.tracks.flatMap((row) => {
    const fields = libraryTrackFields(row, albumTrackContext(row, queryClient));
    const track = fields ? toSavedTrack(fields) : null;
    return track ? [{ track, row }] : [];
  });
  if (mode !== "songs-and-albums") return { songs, albums: [] };

  const albums = await mapWithLimit(
    lists.albums,
    ALBUM_READS_AT_ONCE,
    async (album): Promise<FavoriteAlbumSave> => {
      const ref = albumRef(album);
      const queryKey = libraryKeys.tracks(ref);
      const read = hasSaved("album", ref)
        ? Promise.resolve(queryClient.getQueryData<Track[]>(queryKey) ?? null)
        : readAlbumTracks(queryClient, ref);
      const tracks = await read.then(
        (found) => (found ? sortByDisc(found) : null),
        () => null,
      );
      return {
        ref,
        route: {
          title: album.albumName,
          artistName: album.artistName ?? "",
          artistMbid: album.artistMbid ?? "",
          albumMbid: album.mbid ?? "",
          coverUrl: album.coverUrl ?? "",
          libraryAlbumId: album.canonicalId ?? "",
          artistId: album.artistId ?? "",
        },
        album,
        tracks,
      };
    },
  );
  return { songs, albums };
}

function readAlbumTracks(queryClient: QueryClient, ref: string) {
  return queryClient.fetchQuery({
    queryKey: libraryKeys.tracks(ref),
    queryFn: () => getCanonicalAlbumTracks(ref),
    staleTime: ALBUM_TRACKS_STALE_MS,
  });
}

/**
 * The track lists of the albums that answer within `waitMs`. Library album
 * rows carry no size, so an album's size is its tracks'.
 */
async function albumTracksWithin(
  queryClient: QueryClient,
  albums: Album[],
  waitMs: number,
): Promise<{ tracks: Map<string, Track[]>; complete: boolean }> {
  const tracks = new Map<string, Track[]>();
  const reads = mapWithLimit(albums, ALBUM_READS_AT_ONCE, async (album) => {
    const ref = albumRef(album);
    const list = await readAlbumTracks(queryClient, ref).catch(() => null);
    if (list) tracks.set(ref, list);
  }).then(() => true);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), waitMs);
  });
  const complete = await Promise.race([reads, timedOut]);
  clearTimeout(timer);
  return { tracks: new Map(tracks), complete };
}

/** The ref the album's page and long-press sheet save it under. */
function albumRef(album: Album): string {
  return (
    libraryTracksRef({
      albumId: album.id,
      albumMbid: album.mbid,
      libraryAlbumId: album.canonicalId,
    }) ?? album.id
  );
}

/** Any favorites read on hand, whatever its order. */
function cachedFavoriteLists(queryClient: QueryClient): FavoriteLists | null {
  const reads = queryClient.getQueriesData<FavoriteLists>({
    queryKey: [...libraryKeys.favorites(), "lists"],
  });
  return reads.find(([, lists]) => lists)?.[1] ?? null;
}

function countOf(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * What turning on `to` from `from` adds, as "48 songs and 6 albums, about
 * 7.4 GB", or "at least" when some albums' tracks weren't read in time.
 */
function addedLine(
  lists: FavoriteLists,
  from: FavoritesSaveMode | null,
  to: FavoritesSaveMode,
  albumTracks: { tracks: Map<string, Track[]>; complete: boolean },
): string | null {
  const songs = lists.tracks.filter((track) => track.streamPath);
  const albums = to === "songs-and-albums" ? lists.albums : [];
  const songIds = new Set(songs.map((track) => track.id));
  const size = (track: Track) => Math.max(0, track.size);
  const songBytes = songs.reduce((sum, track) => sum + size(track), 0);
  const albumBytes = albums.reduce(
    (sum, album) =>
      sum +
      (albumTracks.tracks.get(albumRef(album)) ?? [])
        .filter((track) => track.streamPath && !songIds.has(track.id))
        .reduce((albumSum, track) => albumSum + size(track), 0),
    0,
  );

  // From Songs, the songs are on the phone already.
  const addsSongs = from !== "songs";
  const parts = [
    addsSongs && songs.length > 0
      ? countOf(songs.length, "song", "songs")
      : null,
    albums.length > 0 ? countOf(albums.length, "album", "albums") : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const bytes = (addsSongs ? songBytes : 0) + albumBytes;
  const allSized = albums.length === 0 || albumTracks.complete;
  if (bytes === 0) return `${parts.join(" and ")}.`;
  return `${parts.join(" and ")}, ${allSized ? "about" : "at least"} ${formatBytes(bytes)}.`;
}

/**
 * Favorites' save setting, with the question each change asks first: saving
 * gives the size, and keeping less says what leaves the phone. `onCancel`
 * lets a picker go back to the setting it showed.
 */
export function useFavoritesSaveChoice() {
  const mode = useFavoritesSave();
  const queryClient = useQueryClient();

  const choose = useCallback(
    async (
      next: FavoritesSaveMode | null,
      { onCancel }: { onCancel?: () => void } = {},
    ) => {
      if (next === mode) return;
      const cancel = {
        text: "Cancel",
        style: "cancel" as const,
        onPress: onCancel,
      };
      const apply = () => void setFavoritesSave(next);

      const keepsLess =
        next === null || (mode === "songs-and-albums" && next === "songs");
      if (keepsLess) {
        const albumsOnly = next === "songs";
        Alert.alert(
          albumsOnly
            ? "Remove Favorite Albums from Phone?"
            : "Remove Favorites from Phone?",
          albumsOnly
            ? "Albums saved only with Favorites will need a connection to play."
            : "Songs and albums saved only with Favorites will need a connection to play.",
          [
            cancel,
            {
              text: "Remove",
              style: "destructive",
              onPress: () => {
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
                apply();
              },
            },
          ],
          { onDismiss: onCancel },
        );
        return;
      }

      const lists = cachedFavoriteLists(queryClient);
      const albumTracks =
        lists && next === "songs-and-albums"
          ? await albumTracksWithin(
              queryClient,
              lists.albums,
              SIZE_READS_WAIT_MS,
            )
          : { tracks: new Map<string, Track[]>(), complete: true };
      const added = lists ? addedLine(lists, mode, next, albumTracks) : null;
      const later =
        next === "songs"
          ? "Songs you favorite later are saved too."
          : "Songs and albums you favorite later are saved too.";
      Alert.alert(
        mode === "songs"
          ? "Save Favorite Albums Offline?"
          : "Save Favorites Offline?",
        added ? `${added} ${later}` : later,
        [
          cancel,
          {
            text: "Save",
            onPress: () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              apply();
            },
          },
        ],
        { onDismiss: onCancel },
      );
    },
    [mode, queryClient],
  );

  return { mode, choose };
}
