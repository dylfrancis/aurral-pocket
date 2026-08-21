import type { LibraryReadOptions } from "@/lib/types/library";

/**
 * The read path the library screens use.
 *
 * Server 2.5.0 added the canonical library. It is a dedicated database of
 * owned artists, albums, and tracks, scanned from the Aurral root and from the
 * root folders that Lidarr reports.
 *
 * The screens still read the legacy path, because the canonical library is
 * built from media files. Its base query starts `FROM library_media_files` and
 * joins the rest, so a record with no file never appears, whatever the
 * availableOnly flag says. The three library routes also hardcode
 * availableOnly, so a client cannot ask for the missing records.
 *
 * The library screens manage wanted music as well as owned music, and they
 * need the records the canonical library omits:
 *
 * - An artist added a minute ago has no files yet. On the canonical path the
 *   library list would not show it, and the artist screen polls for exactly
 *   that state.
 * - A monitored album that is still downloading has no files yet. The artist
 *   screen shows it at 0%, and useResearchMissingAlbums counts it.
 * - A track with no file drives the missing marker in TrackRow.
 *
 * Switch this to `{ readPath: "canonical", source: "all" }` once the server
 * can return the wanted records too, or once the screens read the wanted set
 * separately. Everything below the screens already handles both paths. See
 * issue #199.
 *
 * `source` stays "all" until the server ships split Lidarr and Aurral
 * ownership modes.
 */
export const LIBRARY_READ: LibraryReadOptions = {};

/** True when the library screens read from the canonical library. */
export const READS_CANONICAL: boolean = LIBRARY_READ.readPath === "canonical";

type ArtistReference = {
  /** The Lidarr artist id. */
  artistId?: string;
  /** The MusicBrainz artist id. */
  artistMbid?: string;
};

/**
 * Pick the identifier that addresses an artist's albums.
 *
 * The two read paths do not share an artist identifier. Lidarr ids are unique
 * to Lidarr, and the canonical library assigns its own ids. The MusicBrainz id
 * is the only identifier both understand, and the canonical route matches it,
 * so the canonical path addresses albums by MBID.
 *
 * Every caller must resolve the reference through this function. The result is
 * both the request parameter and the React Query key, so a mismatch between
 * the two would leave a cache entry that no mutation can invalidate.
 */
export function resolveAlbumsRef(
  canonical: boolean,
  { artistId, artistMbid }: ArtistReference,
): string | undefined {
  if (canonical) return artistMbid || artistId;
  return artistId;
}

export function libraryAlbumsRef(reference: ArtistReference) {
  return resolveAlbumsRef(READS_CANONICAL, reference);
}

/**
 * Pick the identifier that addresses an album's tracks.
 *
 * The canonical route matches an album id, an MBID, or a foreign album id. A
 * Lidarr album id matches none of them, so the canonical path prefers the
 * MBID, then the canonical album id.
 */
type AlbumReference = {
  /** The Lidarr album id. */
  albumId?: string;
  /** The MusicBrainz release-group id. */
  albumMbid?: string;
  /** The album id in the canonical library. */
  canonicalAlbumId?: string;
};

export function resolveTracksRef(
  canonical: boolean,
  { albumId, albumMbid, canonicalAlbumId }: AlbumReference,
): string | undefined {
  if (canonical) return albumMbid || canonicalAlbumId || albumId;
  return albumId;
}

export function libraryTracksRef(reference: AlbumReference) {
  return resolveTracksRef(READS_CANONICAL, reference);
}
