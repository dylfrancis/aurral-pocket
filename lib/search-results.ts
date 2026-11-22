import { albumRouteParams } from "@/lib/library-read";
import type {
  LibrarySearchAlbum,
  LibrarySearchArtist,
  SearchAlbum,
  SearchArtist,
} from "@/lib/types/search";

export type ArtistResult = {
  artist: SearchArtist;
  /** Server-relative Library artwork, for a Library artist. */
  image: string | null;
  fromLibrary: boolean;
};

/** An album row in search, opened differently by where it came from. */
export type AlbumResult =
  | { kind: "library"; key: string; album: LibrarySearchAlbum }
  | { kind: "catalog"; key: string; album: SearchAlbum };

/**
 * Library artists first, then catalog artists the Library doesn't have. An
 * artist with no MBID has no page to open, so it's left out.
 */
export function mergeArtists(
  library: readonly LibrarySearchArtist[],
  catalog: readonly SearchArtist[],
): ArtistResult[] {
  const results: ArtistResult[] = library
    .filter((artist) => artist.hasMbid)
    .map((artist) => ({
      artist: { id: artist.id, name: artist.name, disambiguation: null },
      image: artist.image,
      fromLibrary: true,
    }));
  const seen = new Set(results.map((result) => result.artist.id));
  for (const artist of catalog) {
    if (seen.has(artist.id)) continue;
    seen.add(artist.id);
    results.push({ artist, image: null, fromLibrary: false });
  }
  return results;
}

/**
 * Library albums first, then catalog albums whose release group the Library
 * doesn't have.
 */
export function mergeAlbums(
  library: readonly LibrarySearchAlbum[],
  catalog: readonly SearchAlbum[],
): AlbumResult[] {
  const results: AlbumResult[] = library.map((album) => ({
    kind: "library",
    key: `library-${album.libraryId}`,
    album,
  }));
  const seen = new Set(library.flatMap((album) => album.id ?? []));
  for (const album of catalog) {
    if (seen.has(album.id)) continue;
    seen.add(album.id);
    results.push({ kind: "catalog", key: `catalog-${album.id}`, album });
  }
  return results;
}

/** A bare path, so expo-router opens the album in the search's own stack. */
export function libraryAlbumHref(album: LibrarySearchAlbum) {
  return {
    pathname: "/album/[ref]" as const,
    params: albumRouteParams(
      {
        id: album.libraryId,
        canonicalId: album.libraryId,
        mbid: album.id ?? undefined,
        albumName: album.title,
        coverUrl: album.coverUrl ?? undefined,
      },
      album.artistName,
      album.artistMbid ?? undefined,
    ),
  };
}
