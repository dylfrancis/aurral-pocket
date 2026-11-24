import { useMemo } from "react";
import {
  FAVORITE_SORT_OPTIONS,
  type LibrarySongSortMode,
} from "@/components/library/AlbumSortPicker";
import { albumTrackArtist } from "@/hooks/library/album-track-context";
import {
  byAlbumArtist,
  byAlbumName,
  savedAlbumCard,
} from "@/hooks/offline/use-saved-albums";
import { useSavedItems, type SavedAlbum } from "@/lib/offline/saved-library";
import { stripArticle } from "@/lib/strings";
import type { Album, AlbumTrack, FavoriteLists } from "@/lib/types/library";

const SAVED_FAVORITE_SORTS = [
  "favorited",
  "name-asc",
  "name-desc",
  "artist-asc",
  "artist-desc",
] as const satisfies readonly LibrarySongSortMode[];

type SavedFavoriteSortMode = (typeof SAVED_FAVORITE_SORTS)[number];

/** Favorites' sorts the phone can do, with no plays or dates to go on. */
export const SAVED_FAVORITE_SORT_OPTIONS = FAVORITE_SORT_OPTIONS.filter(
  (option): option is typeof option & { key: SavedFavoriteSortMode } =>
    (SAVED_FAVORITE_SORTS as readonly string[]).includes(option.key),
);

type Ranked<T> = { entry: T; rank: number };

/**
 * The favorites Favorites keeps on the phone, as the screen lists them with
 * no connection. Artists aren't kept. Recently Favorited is the order
 * Favorites last read them in.
 */
export function useSavedFavorites(sort: SavedFavoriteSortMode) {
  const saves = useSavedItems();
  return useMemo(() => {
    const saveOf = new Map<string, SavedAlbum>();
    const albums: Ranked<Album>[] = [];
    const tracks: Ranked<AlbumTrack>[] = [];
    for (const { item } of saves) {
      if (!item.favorite) continue;
      const rank = item.favoriteRank ?? Number.MAX_SAFE_INTEGER;
      if (item.kind === "album") {
        saveOf.set(item.id, item);
        albums.push({ entry: savedAlbumCard(item), rank });
      } else if (item.kind === "song" && item.row) {
        tracks.push({ entry: item.row, rank });
      }
    }
    const lists: FavoriteLists = {
      artists: [],
      albums: sorted(albums, sort, byAlbumName, byAlbumArtist),
      tracks: sorted(tracks, sort, byTrackName, byTrackArtist),
    };
    return {
      lists,
      savedAlbumFor: (album: Album) => saveOf.get(album.id),
    };
  }, [saves, sort]);
}

function byTrackName(a: AlbumTrack, b: AlbumTrack): number {
  return stripArticle(a.trackName).localeCompare(stripArticle(b.trackName));
}

function byTrackArtist(a: AlbumTrack, b: AlbumTrack): number {
  return (
    stripArticle(albumTrackArtist(a)).localeCompare(
      stripArticle(albumTrackArtist(b)),
    ) || byTrackName(a, b)
  );
}

function sorted<T>(
  list: Ranked<T>[],
  mode: SavedFavoriteSortMode,
  byName: (a: T, b: T) => number,
  byArtist: (a: T, b: T) => number,
): T[] {
  const entries = [...list];
  switch (mode) {
    case "favorited":
      entries.sort((a, b) => a.rank - b.rank);
      break;
    case "name-asc":
      entries.sort((a, b) => byName(a.entry, b.entry));
      break;
    case "name-desc":
      entries.sort((a, b) => byName(b.entry, a.entry));
      break;
    case "artist-asc":
      entries.sort((a, b) => byArtist(a.entry, b.entry));
      break;
    case "artist-desc":
      entries.sort((a, b) => byArtist(b.entry, a.entry));
      break;
  }
  return entries.map(({ entry }) => entry);
}
