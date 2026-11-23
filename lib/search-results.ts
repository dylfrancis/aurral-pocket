import { authenticatedClipUrl } from "@/lib/api/client";
import { albumRouteParams } from "@/lib/library-read";
import type { PlayerAlbumContext, PlayerTrack } from "@/lib/player/track-item";
import type {
  CatalogSong,
  LibrarySearchAlbum,
  LibrarySearchArtist,
  LibrarySearchTrack,
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

/** A song row in search: a Library file to play, or a catalog song's clip. */
export type SongResult =
  | { kind: "library"; key: string; track: LibrarySearchTrack }
  | { kind: "catalog"; key: string; song: CatalogSong };

/**
 * Library songs first, then catalog songs the Library doesn't have, by the
 * server's mark or by recording.
 */
export function mergeSongs(
  library: readonly LibrarySearchTrack[],
  catalog: readonly CatalogSong[],
): SongResult[] {
  const results: SongResult[] = library.map((track) => ({
    kind: "library",
    key: `library-${track.id}`,
    track,
  }));
  const seen = new Set(library.flatMap((track) => track.trackMbid ?? []));
  for (const song of catalog) {
    if (song.inLibrary || seen.has(song.id)) continue;
    seen.add(song.id);
    results.push({ kind: "catalog", key: `catalog-${song.id}`, song });
  }
  return results;
}

/** A clip's queue id, shared with the same recording's Top Tracks clip. */
export function catalogSongClipId(song: CatalogSong): string {
  return `preview:${song.id}`;
}

/** The server finds the clip on Deezer by artist and title, as the web asks. */
export function catalogSongClipPath(song: CatalogSong): string {
  return `/api/deezer/preview?artist=${encodeURIComponent(song.artistName)}&track=${encodeURIComponent(song.title)}`;
}

export function catalogSongContext(song: CatalogSong): PlayerAlbumContext {
  return {
    albumTitle: song.albumTitle ?? "",
    artistName: song.artistName,
    coverPath: null,
    artworkUrl: song.coverUrl,
    albumMbid: song.albumMbid,
    artistMbid: song.artistMbid,
  };
}

/** A catalog song's clip as a queue item. Null while signed out. */
export function catalogSongClip(song: CatalogSong): PlayerTrack | null {
  const url = authenticatedClipUrl(catalogSongClipPath(song));
  if (!url) return null;
  return {
    id: catalogSongClipId(song),
    title: song.title,
    artist: song.artistName,
    album: song.albumTitle ?? "",
    duration: 0,
    url,
    artwork: song.coverUrl,
    streamPath: null,
    coverPath: null,
    trackMbid: null,
    artistMbid: song.artistMbid,
    albumMbid: null,
    favorite: null,
    isPreview: true,
  };
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
