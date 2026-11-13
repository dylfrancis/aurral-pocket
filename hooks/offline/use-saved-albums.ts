import { useMemo } from "react";
import type { LibraryAlbumSortMode } from "@/components/library/AlbumSortPicker";
import { useSavedItems, type SavedAlbum } from "@/lib/offline/saved-library";
import { stripArticle } from "@/lib/strings";
import type { Album } from "@/lib/types/library";

/**
 * The account's saved albums, as an album grid shows them. The library's grid
 * pages, searches and sorts on the server, which can't say what's saved and
 * can't answer offline, so these are searched and sorted on the phone.
 *
 * Each card is keyed by the save, so the page it opens is the one that was
 * saved. "Recently Added" means recently saved here.
 */
export function useSavedAlbums(query: string, sortMode: LibraryAlbumSortMode) {
  const saves = useSavedItems();
  return useMemo(() => {
    const byId = new Map<string, SavedAlbum>();
    const cards: { album: Album; savedAt: number }[] = [];
    for (const { item } of saves) {
      if (item.kind !== "album") continue;
      byId.set(item.id, item);
      cards.push({ album: cardFor(item), savedAt: item.savedAt });
    }

    const needle = query.trim().toLowerCase();
    const matching = needle
      ? cards.filter(({ album }) =>
          `${album.albumName}\n${album.artistName}`
            .toLowerCase()
            .includes(needle),
        )
      : cards;

    return {
      albums: sorted(matching, sortMode).map(({ album }) => album),
      savedAlbumFor: (album: Album) => byId.get(album.id),
      hasSaves: cards.length > 0,
    };
  }, [saves, query, sortMode]);
}

function cardFor(item: SavedAlbum): Album {
  const { route } = item;
  const album: Album = item.album ?? {
    id: item.id,
    artistId: route.artistId,
    artistName: route.artistName,
    mbid: route.albumMbid,
    foreignAlbumId: route.albumMbid,
    albumName: route.title,
    title: route.title,
    releaseDate: null,
    monitored: false,
    statistics: {
      trackCount: item.tracks.length,
      sizeOnDisk: 0,
      percentOfTracks: 100,
    },
    ...(route.coverUrl ? { coverUrl: route.coverUrl } : {}),
  };
  return { ...album, id: item.id };
}

function byName(a: Album, b: Album): number {
  return stripArticle(a.albumName).localeCompare(stripArticle(b.albumName));
}

function byArtist(a: Album, b: Album): number {
  return (
    stripArticle(a.artistName).localeCompare(stripArticle(b.artistName)) ||
    byName(a, b)
  );
}

function sorted<T extends { album: Album; savedAt: number }>(
  cards: T[],
  mode: LibraryAlbumSortMode,
): T[] {
  const list = [...cards];
  switch (mode) {
    case "name-asc":
      return list.sort((a, b) => byName(a.album, b.album));
    case "name-desc":
      return list.sort((a, b) => byName(b.album, a.album));
    case "artist-asc":
      return list.sort((a, b) => byArtist(a.album, b.album));
    case "artist-desc":
      return list.sort((a, b) => byArtist(b.album, a.album));
    case "newest":
      return list.sort((a, b) => b.savedAt - a.savedAt);
  }
}
