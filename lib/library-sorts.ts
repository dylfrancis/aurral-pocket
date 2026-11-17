import type {
  LibraryAlbumSortMode,
  LibraryArtistSortMode,
} from "@/components/library/AlbumSortPicker";
import type { LibraryListParams, LibrarySort } from "@/lib/types/library";

// The server flips direction for every order but name and artist, so `asc`
// is newest, latest or most first.
const SERVER_SORTS: Record<
  LibraryAlbumSortMode,
  Pick<LibraryListParams, "sort" | "direction">
> = {
  "name-asc": { sort: "name", direction: "asc" },
  "name-desc": { sort: "name", direction: "desc" },
  "artist-asc": { sort: "artist", direction: "asc" },
  "artist-desc": { sort: "artist", direction: "desc" },
  newest: { sort: "newest", direction: "asc" },
  played: { sort: "played", direction: "asc" },
  plays: { sort: "plays", direction: "asc" },
  released: { sort: "released", direction: "asc" },
  random: { sort: "random", direction: "asc" },
  favorited: { sort: "favorited", direction: "asc" },
};

/** How the server is asked for an album or song sort. */
export function serverSort(mode: LibraryAlbumSortMode) {
  return SERVER_SORTS[mode];
}

/**
 * The order the server reads the artist list in. Sorts done on the phone read
 * it by name, so they all share one cached list.
 */
export function artistServerSort(mode: LibraryArtistSortMode): LibrarySort {
  switch (mode) {
    case "played":
    case "plays":
    case "released":
    case "favorited":
      return mode;
    case "alpha":
    case "recent":
    case "albums":
    case "random":
      return "name";
  }
}

/**
 * An item's place in a shuffle, from `seed` and its id (32-bit FNV-1a). The
 * same seed keeps the same order across a search or a reread.
 */
export function shuffleRank(seed: number, id: string): number {
  let hash = 0x811c9dc5 ^ seed;
  for (let index = 0; index < id.length; index++) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

export function newShuffleSeed(): number {
  return Math.floor(Math.random() * 0x100000000);
}
